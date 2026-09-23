/**
 * Sidans ram: språkväxlare i topbaren och sidfotens placering (ADR-13).
 *
 * Språket bärs av URL:en (`?lang=`), aldrig av lagring (NFK-21). Växlaren pekar på samma sida
 * med det andra språket, och interna länkar i menyn får med sig valet så att det inte tappas
 * mellan landningsvyn och verktygsläget.
 */
import { BASE, LM_ENABLED } from '../config/site.ts';
import { getLang, t, type Lang } from '../i18n/index.ts';

const DESKTOP = '(min-width: 900px)';

function withLang(href: string, lang: Lang): string {
  const url = new URL(href, window.location.href);
  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Sätter upp språkväxlaren (#nav-lang) och för valt språk vidare till menyns interna länkar. */
export function initLangToggle(): void {
  const current = getLang();
  const other: Lang = current === 'sv' ? 'en' : 'sv';

  const toggle = document.getElementById('nav-lang');
  if (toggle instanceof HTMLAnchorElement) {
    toggle.href = withLang(window.location.href, other);
    toggle.hreflang = other;
    toggle.lang = other;
    toggle.textContent = t('nav.lang');
    toggle.setAttribute('aria-label', t('nav.langAria'));
  }

  // Bara när besökaren uttryckligen valt språk i URL:en — annars styr webbläsarens språk som vanligt.
  const explicit = new URLSearchParams(window.location.search).get('lang');
  if (explicit !== 'sv' && explicit !== 'en') return;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.topnav a[href], .brand[href]')) {
    if (a.id === 'nav-lang') continue;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith(BASE)) a.href = withLang(href, explicit);
  }
}

/**
 * Sidfoten (#site-footer) är en list under kartan på desktop och sista blocket i panelens
 * scrollyta på mobil — ett DOM-element, flyttat vid brytpunkten. Källförteckningen är hopfälld
 * på desktop (listen ska vara låg) och utfälld i sheeten.
 */
export function placeFooter(panelBody: HTMLElement | null): void {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const sources = footer.querySelector<HTMLDetailsElement>('#sources');
  const mq = window.matchMedia(DESKTOP);

  const place = (): void => {
    if (mq.matches) {
      if (footer.parentElement !== document.body) document.body.appendChild(footer);
      if (sources) sources.open = false;
    } else if (panelBody) {
      if (footer.parentElement !== panelBody) panelBody.appendChild(footer);
      if (sources) sources.open = true;
    }
  };
  mq.addEventListener('change', place);
  place();
}

/**
 * Fyller i det som bara är känt vid bygge: kartutsnittets datum, ortnamnsindexets hämtdatum och
 * antal namn, samt om flygbilden är aktiv. Siffrorna kommer ur datafilerna själva (vite define),
 * så sidfoten kan aldrig påstå något annat än vad som faktiskt levereras (JK-01).
 */
export function fillFooterFacts(): void {
  const topo = document.getElementById('source-topo');
  if (topo) topo.textContent = t('footer.src.topo.body').replace('{date}', __DATA_GENERATED__);

  const ortnamn = document.getElementById('source-ortnamn');
  if (ortnamn) {
    ortnamn.textContent = t('footer.src.ortnamn.body')
      .replace('{date}', __ORTNAMN_FACTS__.date)
      .replace('{count}', __ORTNAMN_FACTS__.count);
  }

  const kommun = document.getElementById('source-kommun');
  if (kommun) kommun.textContent = t('footer.src.kommun.body').replace('{date}', __KOMMUN_RETRIEVED__);

  const orto = document.getElementById('source-orto');
  if (orto && !LM_ENABLED) orto.textContent = `${t('footer.src.orto.body')} ${t('footer.src.orto.pending')}`;
}
