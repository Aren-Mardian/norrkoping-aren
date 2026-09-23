/**
 * In- och utfällning av badplatspanelen (UX-01).
 *
 * På desktop är panelen en kolumn bredvid kartan; den som vill se kartan i helbild fäller in
 * den med pilen i panelhuvudet och får tillbaka den med fliken vid kanten. Valet ligger i
 * `sessionStorage` — det är ett gränssnittsläge, inte något som ska följa besökaren mellan
 * sessioner eller hamna i en cookie (NFK-21).
 *
 * På mobil är panelen en bottom sheet med egna lägen (sheet.ts); där gör knappen ingen nytta
 * och döljs i CSS.
 */
const KEY = 'panel-collapsed';
const DESKTOP = '(min-width: 900px)';

export interface PanelCollapse {
  isCollapsed(): boolean;
  set(collapsed: boolean): void;
}

function remember(collapsed: boolean): void {
  try {
    sessionStorage.setItem(KEY, collapsed ? '1' : '0');
  } catch {
    /* privat läge eller blockerad lagring — läget gäller ändå för den här sidvisningen */
  }
}

function recall(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function createPanelCollapse(panel: HTMLElement, onChange: () => void): PanelCollapse {
  const collapseBtn = document.getElementById('panel-collapse');
  const expandBtn = document.getElementById('panel-expand');
  const desktop = window.matchMedia(DESKTOP);
  let collapsed = recall();

  function apply(): void {
    // Bara desktop fäller in; på mobil styr bottom sheet-lägena.
    const on = collapsed && desktop.matches;
    document.body.classList.toggle('panel-collapsed', on);
    panel.setAttribute('aria-hidden', String(on));
    // Infälld panel ska inte gå att tabba in i.
    panel.inert = on;
    collapseBtn?.setAttribute('aria-expanded', String(!on));
    if (expandBtn) {
      expandBtn.hidden = !on;
      expandBtn.setAttribute('aria-expanded', 'false');
    }
    // Kartan fick ny bredd — OL måste räkna om sin storlek.
    onChange();
  }

  function set(next: boolean): void {
    collapsed = next;
    remember(next);
    apply();
  }

  collapseBtn?.addEventListener('click', () => {
    set(true);
    expandBtn?.focus({ preventScroll: true });
  });
  expandBtn?.addEventListener('click', () => {
    set(false);
    collapseBtn?.focus({ preventScroll: true });
  });
  desktop.addEventListener('change', apply);
  apply();

  return { isCollapsed: () => collapsed && desktop.matches, set };
}
