/**
 * Kartkärnan för landningsvyn: OpenLayers i EPSG:3006 (ADR-03), startvy låst
 * till kommunen (FK-03), panorering begränsad till 25 km buffert (FK-04),
 * skalstock beräknad i projektionen (FK-07) och attribution som inte kan döljas (JK-02).
 *
 * Origo får aldrig importeras här — verktygsläget är en egen lazy route (TK-05).
 */
import Map from 'ol/Map';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import { KOMMUN_BBOX_3006, PAN_LIMIT_3006 } from '../../shared/geo/kommun.ts';
import { LM_3006_RESOLUTIONS } from '../../shared/geo/lmTileGrid.ts';
import { EPSG_3006, registerOlProjections } from '../geo/olProjections.ts';
import { createBasemaps, type Basemaps } from './basemaps.ts';
import { BasemapSwitcherControl, ResetViewControl } from './controls.ts';

export interface AppMap {
  readonly map: Map;
  readonly basemaps: Basemaps;
  resetView(): void;
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
      (KOMMUN_BBOX_3006[0] + KOMMUN_BBOX_3006[2]) / 2,
      (KOMMUN_BBOX_3006[1] + KOMMUN_BBOX_3006[3]) / 2,
    ],
    zoom: 4,
  });

  const basemaps = createBasemaps();

  /** Marginal i pixlar utifrån kartans nuvarande storlek. */
  const startPadding = (): [number, number, number, number] => {
    const [w = 0, h = 0] = map.getSize() ?? [];
    const pad = Math.round(Math.min(w, h) * START_MARGIN);
    return [pad, pad, pad, pad];
  };

  const resetView = (): void => {
    if (!map.getSize()) return;
    view.fit([...KOMMUN_BBOX_3006], {
      padding: startPadding(),
      duration: prefersReducedMotion() ? 0 : 300,
    });
  };

  const map = new Map({
    target,
    view,
    layers: [...basemaps.layers],
    controls: [
      new Zoom(),
      new ScaleLine({ units: 'metric', minWidth: 64 }),
      new Attribution({ collapsible: false }),
      new ResetViewControl(resetView),
      new BasemapSwitcherControl(basemaps),
    ],
  });

  // Startvy (FK-03). Storleken sätts synkront i konstruktorn när containern redan
  // har CSS-höjd; annars väntar vi på första change:size.
  const fitStart = (): void => view.fit([...KOMMUN_BBOX_3006], { padding: startPadding(), duration: 0 });
  if (map.getSize()) fitStart();
  else map.once('change:size', fitStart);

  // UX-04: skelettet ersätts när första ramen med data är ritad — eller senast efter 3 s.
  const ready = (): void => target.classList.add('map--ready');
  map.once('rendercomplete', ready);
  window.setTimeout(ready, 3000);

  basemaps.onChange((id) => target.classList.toggle('map--dark', id === 'dark'));

  return { map, basemaps, resetView };
}
