/**
 * Bottom sheet på mobil, sidopanel på desktop (UX-03). Tre lägen — peek/half/full — som byts med
 * handtaget (knapp: tangentbord + skärmläsare), Escape går till peek, och drag med pekare.
 * På desktop (≥ 900 px) är panelen en vanlig kolumn och lägena ignoreras.
 */

export type SheetState = 'peek' | 'half' | 'full';

const ORDER: SheetState[] = ['peek', 'half', 'full'];
const MQ = '(min-width: 900px)';

export interface Sheet {
  set(state: SheetState): void;
  get(): SheetState;
  /** Öppna minst till "half" — t.ex. när en badplats valts på kartan. */
  reveal(): void;
}

export function createSheet(panel: HTMLElement, handle: HTMLButtonElement): Sheet {
  let state: SheetState = 'peek';
  const desktop = window.matchMedia(MQ);

  function apply(): void {
    panel.dataset['sheet'] = state;
    handle.setAttribute('aria-expanded', String(state !== 'peek'));
    handle.setAttribute('aria-label', state === 'full' ? handle.dataset['labelCollapse'] ?? '' : handle.dataset['labelExpand'] ?? '');
  }

  handle.addEventListener('click', () => {
    state = ORDER[(ORDER.indexOf(state) + 1) % ORDER.length] ?? 'peek';
    apply();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state !== 'peek' && !desktop.matches) {
      state = 'peek';
      apply();
      handle.focus();
    }
  });

  // Enkel drag: mät vertikal rörelse på handtaget och snappa till närmaste läge.
  let startY = 0;
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = startY - e.clientY;
    if (Math.abs(dy) < 30) return; // klick hanteras av click-lyssnaren
    const idx = ORDER.indexOf(state);
    state = ORDER[Math.max(0, Math.min(ORDER.length - 1, idx + (dy > 0 ? 1 : -1)))] ?? state;
    apply();
    e.preventDefault();
  });

  apply();
  return {
    set(s) {
      state = s;
      apply();
    },
    get: () => state,
    reveal() {
      if (desktop.matches || state !== 'peek') return;
      state = 'half';
      apply();
    },
  };
}
