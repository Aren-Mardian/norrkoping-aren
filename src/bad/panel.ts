/**
 * Badplatspanelen: Topp 3 framhävda under badsäsong (FK-15), lista med status och ålder
 * (FK-16, DK-04), varningar som inte kan döljas (FK-17), filter (FK-20-frö), detaljvy med
 * provsvar, alger, avrådan, vattentemperatur och SMHI-väder (FK-18). Listan innehåller samma
 * information som kartan (NFK-09) och är tangentbordsnavigerbar (FK-09).
 *
 * Ingen mallmotor: små render-funktioner som bygger DOM med textContent (ingen innerHTML från data).
 */
import { type StatusLevel, STALE_AFTER_HOURS } from '../../shared/bad/status.ts';
import { VADER_URL } from '../config/site.ts';
import { getLang, t } from '../i18n/index.ts';
import { fetchJson } from '../net/fetchJson.ts';
import { type BadData, type Badplats, type Filter, applyFilter, isBathingSeason, sortSites } from './model.ts';

interface Forecast {
  referenceTime: string | null;
  hours: Array<{ time: string; tempC: number | null; windMs: number | null; gustMs: number | null; precipMm: number | null; precipProb: number | null; symbol: number | null }>;
}

export interface PanelHandlers {
  onSelect(id: string | null): void;
  onHover(id: string | null): void;
}

export interface Panel {
  render(data: BadData): void;
  setSelected(id: string | null): void;
  setHover(id: string | null): void;
  getFilter(): Filter;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function fmtAge(hours: number): string {
  if (hours < 1) return t('bad.age.minutes').replace('{n}', String(Math.max(1, Math.round(hours * 60))));
  if (hours < 48) return t('bad.age.hours').replace('{n}', String(Math.round(hours)));
  return t('bad.age.days').replace('{n}', String(Math.round(hours / 24)));
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(getLang() === 'en' ? 'en-GB' : 'sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function pill(level: StatusLevel, label: string): HTMLElement {
  const p = el('span', `pill pill--${level}`);
  p.appendChild(el('span', 'pill__glyph', { ok: '✓', warn: '!', bad: '✕', unknown: '?' }[level]));
  p.appendChild(el('span', undefined, label));
  return p;
}

function levelText(site: Badplats): string {
  const s = site.status;
  if (!s) return t('bad.level.unknown');
  if (s.advisory) return t('bad.advisory');
  if (s.latestSample?.result) return s.latestSample.result;
  return t('bad.level.unknown');
}

export function createPanel(root: HTMLElement, handlers: PanelHandlers): Panel {
  const lang = getLang();
  let data: BadData | null = null;
  let filter: Filter = 'alla';
  let selectedId: string | null = null;
  let weatherAbort: AbortController | null = null;

  const meta = root.querySelector<HTMLElement>('#bad-meta')!;
  const chips = root.querySelector<HTMLElement>('#bad-filter')!;
  const top3 = root.querySelector<HTMLElement>('#bad-top3')!;
  const list = root.querySelector<HTMLOListElement>('#bad-list')!;
  const detail = root.querySelector<HTMLElement>('#bad-detail')!;
  const count = root.querySelector<HTMLElement>('#bad-count')!;

  const FILTERS: Filter[] = ['alla', 'top3', 'hav', 'sjö'];
  for (const f of FILTERS) {
    const b = el('button', 'chip', t(`bad.filter.${f}`));
    b.type = 'button';
    b.dataset['filter'] = f;
    b.setAttribute('aria-pressed', String(f === filter));
    b.addEventListener('click', () => {
      filter = f;
      for (const c of chips.querySelectorAll('button')) c.setAttribute('aria-pressed', String(c.dataset['filter'] === f));
      renderList();
    });
    chips.appendChild(b);
  }

  function card(site: Badplats, compact = false): HTMLElement {
    const li = el(compact ? 'div' : 'li', `beach${site.props.isTop3 ? ' beach--top3' : ''}${site.id === selectedId ? ' is-selected' : ''}`);
    li.dataset['id'] = site.id;
    const btn = el('button', 'beach__btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', `${site.props.fullName}: ${levelText(site)}`);
    const head = el('div', 'beach__head');
    if (site.props.isTop3) head.appendChild(el('span', 'beach__rank', String(site.props.top3Rank)));
    const names = el('div', 'beach__names');
    names.appendChild(el('span', 'beach__name', site.props.name[lang]));
    names.appendChild(el('span', 'beach__water', `${site.props.waterBody ? `${site.props.waterBody} · ` : ''}${t(`bad.type.${site.props.type}`)}`));
    head.appendChild(names);
    btn.appendChild(head);
    const row = el('div', 'beach__row');
    row.appendChild(pill(site.level, levelText(site)));
    if (site.status?.waterTemperatureC !== null && site.status?.waterTemperatureC !== undefined) {
      row.appendChild(el('span', 'beach__temp', `${site.status.waterTemperatureC.toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE')} °C`));
    }
    btn.appendChild(row);
    if (site.status?.advisory) {
      const warn = el('p', 'beach__advisory', `${t('bad.advisoryLabel')}: ${site.status.advisory.text}`);
      warn.setAttribute('role', 'alert');
      btn.appendChild(warn);
    }
    btn.addEventListener('click', () => handlers.onSelect(site.id));
    btn.addEventListener('mouseenter', () => handlers.onHover(site.id));
    btn.addEventListener('mouseleave', () => handlers.onHover(null));
    btn.addEventListener('focus', () => handlers.onHover(site.id));
    btn.addEventListener('blur', () => handlers.onHover(null));
    li.appendChild(btn);
    return li;
  }

  function renderMeta(): void {
    meta.replaceChildren();
    if (!data) return;
    if (!data.status) {
      meta.appendChild(el('span', 'meta--warn', t('bad.status.unavailable')));
      return;
    }
    const age = data.status.ageHours;
    const stale = age > STALE_AFTER_HOURS || data.status.stale;
    const span = el('span', stale ? 'meta--warn' : undefined, `${t('bad.status.updated')} ${fmtAge(age)}${stale ? ` · ${t('bad.status.stale')}` : ''}`);
    meta.appendChild(span);
    meta.appendChild(el('span', 'meta__source', ` · ${t('bad.source')}`));
  }

  function renderTop3(): void {
    top3.replaceChildren();
    if (!data) return;
    const season = isBathingSeason();
    const picks = sortSites(data.sites).filter((s) => s.props.isTop3 && !s.status?.advisory).slice(0, 3);
    if (picks.length === 0) return;
    top3.hidden = false;
    top3.classList.toggle('top3--offseason', !season);
    const h = el('h3', 'top3__title', season ? t('bad.top3.title') : t('bad.top3.titleOffseason'));
    top3.appendChild(h);
    const grid = el('div', 'top3__grid');
    for (const s of picks) grid.appendChild(card(s, true));
    top3.appendChild(grid);
    const method = el('a', 'top3__method', t('bad.top3.method'));
    method.href = `${import.meta.env.BASE_URL}metod`;
    top3.appendChild(method);
  }

  function renderList(): void {
    list.replaceChildren();
    if (!data) return;
    const sites = sortSites(applyFilter(data.sites, filter));
    for (const s of sites) list.appendChild(card(s));
    count.textContent = t('bad.count').replace('{n}', String(sites.length)).replace('{total}', String(data.sites.length));
  }

  async function renderDetail(site: Badplats): Promise<void> {
    weatherAbort?.abort();
    weatherAbort = new AbortController();
    detail.replaceChildren();
    detail.hidden = false;
    const back = el('button', 'detail__back', t('bad.detail.back'));
    back.type = 'button';
    back.addEventListener('click', () => handlers.onSelect(null));
    detail.appendChild(back);
    const h = el('h3', 'detail__title', site.props.name[lang]);
    detail.appendChild(h);
    detail.appendChild(el('p', 'detail__sub', `${site.props.waterBody ?? ''}${site.props.waterBody ? ' · ' : ''}${t(`bad.type.${site.props.type}`)}${site.props.isTop3 ? ` · ${t('bad.top3.badge').replace('{n}', String(site.props.top3Rank))}` : ''}`));

    const s = site.status;
    if (s?.advisory) {
      const box = el('div', 'advisory');
      box.setAttribute('role', 'alert');
      box.appendChild(el('strong', undefined, t('bad.advisory')));
      box.appendChild(el('p', undefined, `${s.advisory.text}${s.advisory.since ? ` (${t('bad.since')} ${fmtDate(s.advisory.since)})` : ''}`));
      detail.appendChild(box);
    }

    const dl = el('dl', 'facts');
    const fact = (k: string, v: string | HTMLElement): void => {
      dl.appendChild(el('dt', undefined, k));
      const dd = el('dd');
      if (typeof v === 'string') dd.textContent = v;
      else dd.appendChild(v);
      dl.appendChild(dd);
    };
    fact(t('bad.detail.status'), pill(site.level, levelText(site)));
    if (s?.latestSample) fact(t('bad.detail.latestSample'), `${s.latestSample.result ?? '–'} · ${fmtDate(s.latestSample.date)}`);
    fact(t('bad.detail.classification'), s ? `${s.classification}${s.classificationSeason ? ` (${s.classificationSeason})` : ''}` : '–');
    fact(t('bad.detail.algae'), s ? t(`bad.algae.${s.algae.status}`) : '–');
    if (s?.waterTemperatureC !== null && s?.waterTemperatureC !== undefined) {
      fact(t('bad.detail.waterTemp'), `${s.waterTemperatureC.toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE')} °C · ${fmtDate(s.waterTemperatureAt)}`);
    }
    fact(t('bad.detail.accuracy'), `±${site.props.provenance.positionAccuracyM} m`);
    detail.appendChild(dl);

    if (site.props.isTop3 && site.props.top3Rationale) {
      detail.appendChild(el('p', 'detail__rationale', site.props.top3Rationale[lang]));
    }

    // Väder (FK-18): hämtas först här — inte för alla 19 på en gång.
    const weather = el('section', 'weather');
    weather.appendChild(el('h4', 'weather__title', t('bad.weather.title')));
    const body = el('p', 'weather__body', t('bad.weather.loading'));
    weather.appendChild(body);
    detail.appendChild(weather);
    try {
      const f = await fetchJson<Forecast>(`${VADER_URL}?lat=${site.lonLat[1].toFixed(2)}&lon=${site.lonLat[0].toFixed(2)}`, { signal: weatherAbort.signal, retries: 1 });
      const now = f.hours[0];
      if (!now) throw new Error('tom prognos');
      body.replaceChildren();
      const parts: string[] = [];
      if (now.symbol) parts.push(t(`bad.weather.symbol.${now.symbol}`));
      if (now.tempC !== null) parts.push(`${Math.round(now.tempC)} °C`);
      if (now.windMs !== null) parts.push(`${t('bad.weather.wind')} ${Math.round(now.windMs)} m/s${now.gustMs !== null ? ` (${Math.round(now.gustMs)})` : ''}`);
      if (now.precipProb !== null) parts.push(`${t('bad.weather.rain')} ${Math.round(now.precipProb)} %`);
      body.appendChild(el('span', 'weather__now', parts.join(' · ')));
      const strip = el('ul', 'weather__hours');
      for (const h of f.hours.slice(1, 7)) {
        const li = el('li');
        li.appendChild(el('span', 'weather__h', fmtTime(h.time)));
        li.appendChild(el('span', 'weather__t', h.tempC === null ? '–' : `${Math.round(h.tempC)}°`));
        li.appendChild(el('span', 'weather__p', h.precipProb === null ? '' : `${Math.round(h.precipProb)} %`));
        strip.appendChild(li);
      }
      weather.appendChild(strip);
      weather.appendChild(el('p', 'weather__meta', `${t('bad.weather.source')}${f.referenceTime ? ` · ${t('bad.weather.issued')} ${fmtTime(f.referenceTime)}` : ''}`));
    } catch (err) {
      if (weatherAbort.signal.aborted) return;
      // NFK-25: dölj modulen utan layoutförskjutning i listan — sektionen är sist.
      weather.remove();
    }

    const src = el('p', 'detail__source', `${t('bad.source')} · ${t('bad.detail.provenance')} ${fmtDate(site.props.provenance.updated)}`);
    detail.appendChild(src);
    if (site.props.contact.url) {
      const a = el('a', 'detail__link', t('bad.detail.municipality'));
      a.href = site.props.contact.url.startsWith('http') ? site.props.contact.url : `https://${site.props.contact.url}`;
      a.target = '_blank';
      a.rel = 'noopener';
      detail.appendChild(a);
    }
    back.focus();
  }

  function showList(): void {
    detail.hidden = true;
    weatherAbort?.abort();
    detail.replaceChildren();
    top3.hidden = false;
    list.hidden = false;
    chips.hidden = false;
  }

  return {
    render(d) {
      data = d;
      renderMeta();
      renderTop3();
      renderList();
    },
    setSelected(id) {
      selectedId = id;
      for (const node of root.querySelectorAll<HTMLElement>('.beach')) node.classList.toggle('is-selected', node.dataset['id'] === id);
      const site = id ? data?.sites.find((s) => s.id === id) : undefined;
      if (site) {
        top3.hidden = true;
        list.hidden = true;
        chips.hidden = true;
        void renderDetail(site);
      } else {
        showList();
      }
    },
    setHover(id) {
      for (const node of root.querySelectorAll<HTMLElement>('.beach')) node.classList.toggle('is-hover', node.dataset['id'] === id);
    },
    getFilter: () => filter,
  };
}
