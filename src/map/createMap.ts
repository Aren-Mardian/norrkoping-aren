/**
 * Kartkärnan för landningsvyn: OpenLayers i EPSG:3006 (ADR-03), startvy låst
 * till kommunen (FK-03), panorering begränsad till kommunen + 5 km (FK-04, ADR-16),
 * skalstock beräknad i projektionen (FK-07) och attribution som inte kan döljas (JK-02).
 *
 * Origo får aldrig importeras här — verktygsläget är en egen lazy route (TK-05).
 */
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultInteractions } from 'ol/interaction';
import Attribution from 'ol/control/Attribution';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import { KOMMUN_VIEW_BBOX_3006, PAN_LIMIT_3006 } from '../../shared/geo/kommun.ts';
import { LM_3006_RESOLUTIONS } from '../../shared/geo/lmTileGrid.ts';
import { EPSG_3006, registerOlProjections } from '../geo/olProjections.ts';
import { t } from '../i18n/index.ts';
import { createBasemaps, type Basemaps } from './basemaps.ts';
import { BasemapSwitcherControl, LayerToggleControl, ResetViewControl } from './controls.ts';
import { createKommungransLayer } from './kommungrans.ts';

export interface AppMap {
  readonly map: Map;
  readonly basemaps: Basemaps;
  resetView(): void;
  /**
   * Flyger till en punkt (EPSG:3006) på given LM-nivå — respekterar prefers-reduced-motion.
   * `bottomInsetPx` = så mycket av kartans nederkant som täcks (bottom sheet); punkten
   * centreras i den synliga delen.
   */
  zoomTo(center: number[], zoom: number, bottomInsetPx?: number): void;
  /** Aktuell vy — lämnas över till verktygsläget vid växling (ADR-15). */
  getView(): { center: number[]; zoom: number };
  /** Tar tillbaka en vy från verktygsläget utan animering. */
  setView(center: number[], zoom: number): void;
}

/** Startextent = kommunens bbox med 5 % marginal (FK-03). */
const START_MARGIN = 0.05;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createMap(target: HTMLElement): AppMap {
  registerOlProjections();

  const view = new View({
    projection: EPSG_3006,
    // Zoomstegen följer Lantmäteriets tile-matris så att rutorna renderas skarpa.
    resolutions: [...LM_3006_RESOLUTIONS],
    maxResolution: LM_3006_RESOLUTIONS[0],
    minResolution: LM_3006_RESOLUTIONS[14],
    extent: [...PAN_LIMIT_3006],
    showFullExtent: true,
    smoothExtentConstraint: true,
    center: [
      (KOMMUN_VIEW_BBOX_3006[0] + KOMMUN_VIEW_BBOX_3006[2]) / 2,
      (KOMMUN_VIEW_BBOX_3006[1] + KOMMUN_VIEW_BBOX_3006[3]) / 2,
    ],
    zoom: 4,
  });

  const basemaps = createBasemaps();
  const kommungrans = createKommungransLayer();

  /** Marginal i pixlar utifrån kartans nuvarande storlek. */
  const startPadding = (): [number, number, number, number] => {
    const [w = 0, h = 0] = map.getSize() ?? [];
    const pad = Math.round(Math.min(w, h) * START_MARGIN);
    return [pad, pad, pad, pad];
  };

  const resetView = (): void => {
    if (!map.getSize()) return;
    view.fit([...KOMMUN_VIEW_BBOX_3006], {
      padding: startPadding(),
      duration: prefersReducedMotion() ? 0 : 300,
    });
  };

  const map = new Map({
    target,
    view,
    // Rullhjulet zoomar direkt, utan Ctrl: kartan fyller sin egen yta och sidan bakom scrollar
    // aldrig (ADR-13), så det finns inget att av misstag zooma i stället för att skrolla.
    // Tvåfingerkrav på pekskärm (pinch) är oförändrat — där är det OL:s standard.
    interactions: defaultInteractions({ onFocusOnly: false }),
    layers: [...basemaps.layers, kommungrans],
    controls: [
      new Zoom(),
      new ScaleLine({ units: 'metric', minWidth: 64 }),
      new Attribution({ collapsible: false }),
      new ResetViewControl(resetView),
      new BasemapSwitcherControl(basemaps),
      new LayerToggleControl(kommungrans, t('map.layer.kommungrans')),
    ],
  });

  // Startvy (FK-03). Layouten kan ändra kartans storlek flera gånger under de första
  // ramarna (CSS laddas, panelen renderas, grid räknas om). Passa in startextent vid varje
  // storleksändring tills användaren rört kartan — då är vyn användarens.
  const fitStart = (): void => {
    const [w = 0, h = 0] = map.getSize() ?? [];
    if (w > 0 && h > 0) view.fit([...KOMMUN_VIEW_BBOX_3006], { padding: startPadding(), duration: 0 });
  };
  let userHasInteracted = false;
  const stopAutoFit = (): void => {
    userHasInteracted = true;
  };
  for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const) {
    target.addEventListener(type, stopAutoFit, { once: true, passive: true });
  }
  map.on('change:size', () => {
    if (!userHasInteracted) fitStart();
  });
  fitStart();

  // UX-04: skelettet ersätts när första ramen med data är ritad — eller senast efter 3 s.
  const ready = (): void => target.classList.add('map--ready');
  map.once('rendercomplete', ready);
  window.setTimeout(ready, 3000);

  basemaps.onChange((id) => {
    target.classList.toggle('map--dark', id === 'dark');
    // Flygbildsläget fäller ut en årtalsrad i växlaren; lagerknappen ovanför flyttas i CSS.
    target.classList.toggle('map--orto', id === 'orto');
  });

  const zoomTo = (center: number[], zoom: number, bottomInsetPx = 0): void => {
    // Programmatisk navigering lämnar också startvyn — annars återställer nästa storleksändring den.
    userHasInteracted = true;
    const offsetY = Math.round(bottomInsetPx / 2);
    const res = LM_3006_RESOLUTIONS[zoom] ?? view.getResolution() ?? 1;
    view.animate({
      center: [center[0] ?? 0, (center[1] ?? 0) - offsetY * res],
      zoom,
      duration: prefersReducedMotion() ? 0 : 400,
    });
  };

  return {
    map,
    basemaps,
    resetView,
    zoomTo,
    getView: () => ({
      center: view.getCenter() ?? [0, 0],
      zoom: view.getZoom() ?? 5,
    }),
    setView(center, zoom) {
      userHasInteracted = true;
      view.setCenter([center[0] ?? 0, center[1] ?? 0]);
      view.setZoom(zoom);
      map.updateSize();
    },
  };
}
