/**
 * Verktygsknappen: en kartyta, två motorer (ADR-15).
 *
 * Vår egen OpenLayers-karta visas direkt. Trycker användaren "Verktyg" hämtas Origo med
 * `import()` — först då betalar besöket för de ~590 kB (brotli) som Origo väger — och monteras
 * i samma ruta med samma vy, samma badplatser och samma markering. Stänger man verktygen tas
 * vyn tillbaka till vår karta, så att man står kvar där man var.
 *
 * Modulen är det enda stället som vet vilken motor som är aktiv; resten av appen anropar
 * `zoomTo`, `setSites`, `setSelected` och `setHover` utan att bry sig.
 */
import type { AppMap } from '../map/createMap.ts';
import { t } from '../i18n/index.ts';
import type { Badplats } from '../bad/model.ts';
import type { Tools } from '../origo/tools.ts';

export interface ToolsController {
  isActive(): boolean;
  setSites(sites: ReadonlyArray<{ site: Badplats; xy: number[] }>): void;
  setSelected(id: string | null): void;
  setHover(id: string | null): void;
  /** Zoomar den karta som är aktiv. `bottomInset` gäller bara vår egen karta (bottom sheet). */
  zoomTo(xy: number[], zoom: number, bottomInset?: number): void;
  onMapSelect(cb: (id: string | null) => void): void;
  onMapHover(cb: (id: string | null) => void): void;
  /** Anropas varje gång verktygen blivit klara att ta emot data. */
  onReady(cb: (tools: Tools) => void): void;
}

export interface ToolsOptions {
  ownMap: AppMap;
  mount: HTMLElement | null;
  mapElement: HTMLElement;
  toggle: HTMLElement | null;
  hojdToggle: HTMLElement | null;
  status: HTMLElement | null;
  onBasemapFailure(): void;
}

export function createToolsController(opts: ToolsOptions): ToolsController {
  const { ownMap, mount, mapElement, toggle, hojdToggle, status } = opts;
  let tools: Tools | null = null;
  let active = false;
  let loading = false;
  const selectListeners: Array<(id: string | null) => void> = [];
  const hoverListeners: Array<(id: string | null) => void> = [];
  const readyListeners: Array<(tools: Tools) => void> = [];

  function say(message: string | null): void {
    if (!status) return;
    status.textContent = message ?? '';
    status.hidden = message === null;
  }

  function syncButtons(): void {
    if (toggle) {
      // Etiketten står still; läget syns på aria-pressed och färgen. Byter texten bredd
      // hoppar hela raden — och på mobil är utrymmet bredvid sökrutan mätt i pixlar.
      toggle.setAttribute('aria-pressed', String(active));
      toggle.setAttribute('title', t(active ? 'tools.close' : 'tools.hint'));
    }
    if (hojdToggle) {
      hojdToggle.hidden = !active;
      if (!active) hojdToggle.setAttribute('aria-pressed', 'false');
    }
  }

  /** Visar den ena motorn och döljer den andra. OL måste få veta att ytan bytt storlek. */
  function show(which: 'own' | 'tools'): void {
    mapElement.hidden = which === 'tools';
    if (mount) mount.hidden = which === 'own';
    // Origo lägger sina egna kontroller längs vänsterkanten; sökrutan flyttas undan i CSS.
    document.body.classList.toggle('tools-active', which === 'tools');
    // Den karta som blir synlig har just fått en ny storlek och måste mäta om sig och rita om.
    // Nästa frame: först då har webbläsaren räknat om layouten efter hidden-växlingen.
    if (which === 'own') requestAnimationFrame(() => ownMap.map.updateSize());
    else requestAnimationFrame(() => tools?.refresh());
  }

  async function activate(): Promise<void> {
    if (loading) return;
    if (tools) {
      // Redan laddad: bara byt vy och visa.
      const view = ownMap.getView();
      tools.zoomTo(view.center, view.zoom);
      active = true;
      show('tools');
      syncButtons();
      return;
    }
    if (!mount) return;
    loading = true;
    say(t('tools.loading'));
    // Växla kartytan FÖRE initieringen. Origo mäter upp sin yta när den skapas, och ändras
    // storleken efteråt behåller rutlagret en tom, cachad ram — då hämtades bakgrundsrutorna
    // men ritades aldrig (ADR-16). Nu byggs Origo direkt i full storlek och storleken ändras
    // aldrig. Ytan står tom någon sekund medan bundlen laddas; skelettet visar att det pågår.
    mount.classList.add('is-loading');
    active = true;
    show('tools');
    syncButtons();
    try {
      const { loadTools } = await import('../origo/tools.ts');
      tools = await loadTools({
        mount,
        view: ownMap.getView(),
        statusHost: status?.parentElement ?? document.body,
        onBasemapFailure: opts.onBasemapFailure,
      });
      tools.onSelect((id) => {
        for (const cb of selectListeners) cb(id);
      });
      tools.onHover((id) => {
        for (const cb of hoverListeners) cb(id);
      });
      say(null);
      for (const cb of readyListeners) cb(tools);
    } catch {
      // Tillbaka till vår karta — användaren ska inte lämnas med en tom ruta.
      active = false;
      show('own');
      say(t('tools.failed'));
    } finally {
      mount.classList.remove('is-loading');
      loading = false;
      syncButtons();
    }
  }

  function deactivate(): void {
    if (tools) {
      // Ta tillbaka vyn så att användaren står kvar där hen var.
      const view = tools.getView();
      ownMap.setView(view.center, view.zoom);
      tools.hojd.setActive(false);
    }
    active = false;
    show('own');
    say(null);
    syncButtons();
  }

  toggle?.addEventListener('click', () => {
    if (active) deactivate();
    else void activate();
  });

  // Förhämtning vid avsikt (NFK-34): den som för muspekaren mot knappen får bundlen hämtad i
  // bakgrunden, så att klicket känns omedelbart. Den som aldrig rör knappen hämtar ingenting.
  let prefetched = false;
  const prefetch = (): void => {
    if (prefetched || tools) return;
    prefetched = true;
    void import('../origo/tools.ts');
  };
  for (const type of ['pointerenter', 'focus', 'touchstart'] as const) {
    toggle?.addEventListener(type, prefetch, { once: true, passive: true });
  }

  hojdToggle?.addEventListener('click', () => {
    if (!tools) return;
    const next = !tools.hojd.isActive();
    tools.hojd.setActive(next);
    hojdToggle.setAttribute('aria-pressed', String(next));
  });

  syncButtons();

  return {
    isActive: () => active,
    setSites(sites) {
      tools?.setSites(sites);
    },
    setSelected(id) {
      tools?.setSelected(id);
    },
    setHover(id) {
      tools?.setHover(id);
    },
    zoomTo(xy, zoom, bottomInset = 0) {
      if (active && tools) tools.zoomTo(xy, zoom);
      else ownMap.zoomTo(xy, zoom, bottomInset);
    },
    onMapSelect(cb) {
      selectListeners.push(cb);
    },
    onMapHover(cb) {
      hoverListeners.push(cb);
    },
    onReady(cb) {
      readyListeners.push(cb);
      if (tools) cb(tools);
    },
  };
}
