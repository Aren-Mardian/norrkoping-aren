/**
 * Om projektet, Källor och licenser samt Integritet — renderade i en modal dialog i samma sida
 * (ADR-15: sajten har en sida och en karta).
 *
 * Varför en `<dialog>` och inte egna adresser: kartan ska aldrig behöva laddas om för att man
 * läser en informationstext, och ensidesarkitekturen har inga andra sidor att gå till. Elementet
 * `<dialog>` med `showModal()` ger fokusfälla, Escape och återställt fokus av webbläsaren själv —
 * mindre kod och mer korrekt än en handbyggd overlay (NFK-08).
 *
 * Modulen hämtas med `import()` först när någon öppnar en sida, så varken texterna eller den här
 * koden finns i landningsvyns kritiska väg (NFK-02, TK-05). Adressen `#om`, `#kallor` och
 * `#integritet` går att dela och att öppna direkt.
 */
import { LOCALE } from '../i18n/index.ts';
import { sidaFromHash, type SidaId } from './ids.ts';
import { SIDOR, type Block, type Sida } from './innehall.ts';
import './sidor.css';

let dialog: HTMLDialogElement | null = null;
let body: HTMLElement | null = null;
let heading: HTMLElement | null = null;
let baseTitle = '';

/** `[text](url)` och `**fet**`. Allt byggs som noder — ingen sträng rör innerHTML (NFK-16). */
function inline(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index;
    if (at > last) frag.append(text.slice(last, at));
    if (m[1] && m[2]) {
      const a = document.createElement('a');
      a.textContent = m[1];
      a.href = m[2];
      // Interna hopp (#kallor) byter sida i dialogen; allt annat är en riktig länk ut.
      if (!m[2].startsWith('#')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      frag.append(a);
    } else if (m[3]) {
      const strong = document.createElement('strong');
      strong.textContent = m[3];
      frag.append(strong);
    }
    last = at + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function renderBlock(block: Block): HTMLElement {
  switch (block.t) {
    case 'h': {
      const h = el('h3');
      h.textContent = block.text;
      return h;
    }
    case 'p': {
      const p = el('p');
      p.append(inline(block.text));
      return p;
    }
    case 'note': {
      const p = el('p', 'sida__note');
      p.append(inline(block.text));
      return p;
    }
    case 'ul': {
      const ul = el('ul', 'sida__list');
      for (const item of block.items) {
        const li = el('li');
        li.append(inline(item));
        ul.append(li);
      }
      return ul;
    }
    case 'dl': {
      const dl = el('dl', 'sida__dl');
      for (const [term, desc] of block.rows) {
        const dt = el('dt');
        dt.textContent = term;
        const dd = el('dd');
        dd.append(inline(desc));
        dl.append(dt, dd);
      }
      return dl;
    }
    case 'table': {
      // Tabellen ligger i en egen scrollruta: på mobil får den rulla i sidled i stället för att
      // tvinga hela dialogen bredare (NFK-11 — ingen horisontell scroll på sidan som helhet).
      const wrap = el('div', 'sida__tablewrap');
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      const table = el('table', 'sida__table');
      if (block.caption) {
        const caption = el('caption');
        caption.textContent = block.caption;
        table.append(caption);
        wrap.setAttribute('aria-label', block.caption);
      }
      const thead = el('thead');
      const hrow = el('tr');
      for (const cell of block.head) {
        const th = el('th');
        th.scope = 'col';
        th.textContent = cell;
        hrow.append(th);
      }
      thead.append(hrow);
      const tbody = el('tbody');
      for (const row of block.rows) {
        const tr = el('tr');
        row.forEach((cell, i) => {
          // Första kolumnen är radens rubrik — det gör tabellen läsbar med skärmläsare (NFK-09).
          const td = i === 0 ? el('th') : el('td');
          if (td instanceof HTMLTableCellElement && i === 0) td.scope = 'row';
          td.append(inline(cell));
          tr.append(td);
        });
        tbody.append(tr);
      }
      table.append(thead, tbody);
      wrap.append(table);
      return wrap;
    }
  }
}

function build(): HTMLDialogElement {
  const d = el('dialog', 'sida');
  d.setAttribute('aria-labelledby', 'sida-titel');

  const close = el('button', 'sida__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Stäng');
  close.title = 'Stäng';
  close.textContent = '✕';
  close.addEventListener('click', () => d.close());

  heading = el('h2', 'sida__title');
  heading.id = 'sida-titel';

  body = el('div', 'sida__body');

  const article = el('article', 'sida__inner');
  article.append(close, heading, body);
  d.append(article);

  // Klick på bakgrunden stänger. <dialog> lägger klicket på sig själv, inte på innehållet.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener('close', () => {
    document.title = baseTitle;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });

  // Interna hopp mellan sidorna (t.ex. Om → Källor) byter innehåll i stället för att navigera.
  d.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement | null)?.closest('a');
    const href = link?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    const next = sidaFromHash(href);
    if (next) {
      e.preventDefault();
      fill(next);
    }
  });

  document.body.append(d);
  return d;
}

function fill(id: SidaId): void {
  const sida: Sida = SIDOR[id];
  if (!heading || !body) return;

  heading.textContent = sida.title;
  body.replaceChildren();

  const lead = el('p', 'sida__lead');
  lead.textContent = sida.lead;
  body.append(lead);
  for (const block of sida.blocks) body.append(renderBlock(block));

  const updated = el('p', 'sida__updated');
  const datum = new Date(`${sida.updated}T00:00:00Z`).toLocaleDateString(LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  updated.textContent = `Innehållet granskades senast ${datum}.`;
  body.append(updated);

  document.title = `${sida.title} — ${baseTitle}`;
  history.replaceState(null, '', `#${id}`);
  body.scrollTop = 0;
}

/** Öppnar sidan. Anropas av den lilla, ivriga delen i ui/sidor.ts. */
export function openSida(id: SidaId): void {
  if (!baseTitle) baseTitle = document.title;
  dialog ??= build();
  fill(id);
  if (!dialog.open) dialog.showModal();
}
