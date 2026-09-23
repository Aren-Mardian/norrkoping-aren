/**
 * Sökrutan över kartan (FK-32). Används av både landningsvyn och Origo-sidan.
 *
 * Det här skalet är litet och ligger i kritiska vägen; själva sökmotorn och indexet
 * (~91 kB gzip) hämtas med `import()` först när användaren visar avsikt att söka —
 * fokus eller första tangenttrycket (TK-05, NFK-34).
 *
 * Tangentbord: piltangenter bläddrar, Enter väljer, Escape stänger (FK-09, WCAG 2.2).
 * Listan är en ARIA-combobox så att skärmläsare annonserar antal träffar.
 */
import { t } from '../i18n/index.ts';
import type { Traff } from './index.ts';

export interface SokOptions {
  /** Anropas när en träff väljs: koordinat i EPSG:3006. */
  onPick(traff: Traff): void;
  /** Placeholder-nyckel, så att Origo-sidan kan säga något annat än landningsvyn. */
  placeholderKey?: string;
}

const DEBOUNCE_MS = 140;

type Engine = typeof import('./index.ts');

export function createSok(container: HTMLElement, opts: SokOptions): { focus(): void } {
  const form = document.createElement('form');
  form.className = 'sok';
  form.setAttribute('role', 'search');

  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.htmlFor = 'sok-input';
  label.textContent = t('sok.label');

  const field = document.createElement('div');
  field.className = 'sok__field';

  const input = document.createElement('input');
  input.id = 'sok-input';
  input.type = 'search';
  input.className = 'sok__input';
  input.autocomplete = 'off';
  input.placeholder = t(opts.placeholderKey ?? 'sok.placeholder');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'sok-lista');
  input.setAttribute('aria-autocomplete', 'list');

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'sok__clear';
  clear.hidden = true;
  clear.textContent = '✕';
  clear.setAttribute('aria-label', t('sok.clear'));

  const list = document.createElement('ul');
  list.id = 'sok-lista';
  list.className = 'sok__list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  const status = document.createElement('p');
  status.className = 'sok__status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  field.append(input, clear);
  form.append(label, field, status, list);
  container.appendChild(form);

  let engine: Promise<Engine> | null = null;
  let traffar: Traff[] = [];
  let active = -1;
  let timer = 0;
  let seq = 0;

  /** Hämtar sökmotorn + indexet en gång. Startas redan vid fokus, så att första tecknet känns snabbt. */
  const load = (): Promise<Engine> => {
    engine ??= import('./index.ts');
    return engine;
  };

  function close(): void {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(next: number): void {
    const options = [...list.querySelectorAll<HTMLLIElement>('li')];
    active = options.length === 0 ? -1 : (next + options.length) % options.length;
    options.forEach((li, i) => li.classList.toggle('is-active', i === active));
    const current = options[active];
    if (current) {
      input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  function pick(index: number): void {
    const traff = traffar[index];
    if (!traff) return;
    input.value = traff.namn;
    clear.hidden = false;
    close();
    opts.onPick(traff);
  }

  function render(): void {
    list.replaceChildren();
    if (traffar.length === 0) {
      close();
      status.textContent = t('sok.noHits');
      status.hidden = false;
      return;
    }
    status.hidden = true;
    traffar.forEach((traff, i) => {
      const li = document.createElement('li');
      li.id = `sok-traff-${i}`;
      li.className = 'sok__hit';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const name = document.createElement('span');
      name.className = 'sok__name';
      name.textContent = traff.namn;
      const type = document.createElement('span');
      type.className = 'sok__type';
      type.textContent = traff.typ;
      li.append(name, type);
      // pointerdown: väljer innan fältet tappar fokus (blur skulle annars stänga listan först).
      li.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pick(i);
      });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(0);
  }

  async function run(query: string): Promise<void> {
    const mine = ++seq;
    if (query.trim().length < 2) {
      traffar = [];
      status.hidden = true;
      close();
      return;
    }
    try {
      const { sok } = await load();
      const hits = await sok(query);
      if (mine !== seq) return; // ett nyare tangenttryck hann före
      traffar = hits;
      render();
    } catch {
      if (mine !== seq) return;
      status.textContent = t('sok.failed');
      status.hidden = false;
      close();
    }
  }

  input.addEventListener('focus', () => void load(), { once: true });
  input.addEventListener('input', () => {
    clear.hidden = input.value === '';
    window.clearTimeout(timer);
    const q = input.value;
    timer = window.setTimeout(() => void run(q), DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Enter' && !list.hidden) {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  input.addEventListener('blur', () => window.setTimeout(close, 120));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (traffar.length > 0) pick(active < 0 ? 0 : active);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    traffar = [];
    status.hidden = true;
    close();
    input.focus();
  });

  return {
    focus: () => input.focus(),
  };
}
