/**
 * Bakgrundskartor (FK-01, FK-02) med graciös degradering (NFK-25, A5).
 *
 *  - topo / orto: Lantmäteriets WMTS i EPSG:3006 via egen tile-proxy (IK-01).
 *  - fallback:    OpenStreetMap i EPSG:3857, reprojicerad av OpenLayers. Används
 *                 när LM inte är konfigurerat (FK-33) eller slutar svara.
 *  - dark:        ingen bakgrund, mörk yta — för egna lager med hög kontrast.
 */
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { API_BASE, LM_ENABLED } from '../config/site.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import { t } from '../i18n/index.ts';

export type BasemapId = 'topo' | 'orto' | 'dark';

export interface Basemaps {
  readonly layers: readonly TileLayer<XYZ>[];
  getActive(): BasemapId;
  setActive(id: BasemapId): void;
  /** Sant när Lantmäteriets tjänst kan användas (konfigurerad och svarar). */
  isLmAvailable(): boolean;
  /** Anropas en gång om LM slutar svara och fallback tar över. */
  onLmFailure(cb: () => void): void;
  onChange(cb: (id: BasemapId) => void): void;
}

/** Efter så många misslyckade rutor utan en enda lyckad byter vi till fallback. */
const FAILURES_BEFORE_FALLBACK = 4;

function lmTileGrid(): TileGrid {
  return new TileGrid({
    extent: [...LM_3006_EXTENT],
    origin: [...LM_3006_ORIGIN],
    resolutions: [...LM_3006_RESOLUTIONS],
    tileSize: LM_TILE_SIZE,
  });
}

function lmLayer(layer: 'topowebb' | 'ortofoto'): TileLayer<XYZ> {
  return new TileLayer({
    visible: false,
    source: new XYZ({
      url: `${API_BASE}/tiles/${layer}/{z}/{y}/{x}.png`,
      projection: EPSG_3006,
      tileGrid: lmTileGrid(),
      attributions: t('attribution.lantmateriet'),
      maxZoom: 14,
      transition: 0,
    }),
  });
}

function fallbackLayer(): TileLayer<XYZ> {
  // I produktion proxas fallbacken (CSP och integritet); utan proxy i dev går den direkt.
  const url = LM_ENABLED
    ? `${API_BASE}/tiles/osm/{z}/{y}/{x}.png`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return new TileLayer({
    visible: false,
    source: new XYZ({
      url,
      attributions: t('attribution.osm'),
      maxZoom: 17,
      transition: 0,
    }),
  });
}

export function createBasemaps(): Basemaps {
  const topo = lmLayer('topowebb');
  const orto = lmLayer('ortofoto');
  const fallback = fallbackLayer();

  let active: BasemapId = 'topo';
  let lmAvailable = LM_ENABLED;
  const failureListeners: Array<() => void> = [];
  const changeListeners: Array<(id: BasemapId) => void> = [];

  function apply(): void {
    topo.setVisible(active === 'topo' && lmAvailable);
    orto.setVisible(active === 'orto' && lmAvailable);
    fallback.setVisible(active !== 'dark' && !lmAvailable);
  }

  function watchForFailure(layer: TileLayer<XYZ>): void {
    const source = layer.getSource();
    if (!source) return;
    let errors = 0;
    let succeeded = false;
    source.on('tileloadend', () => {
      succeeded = true;
    });
    source.on('tileloaderror', () => {
      errors += 1;
      if (!lmAvailable || succeeded || errors < FAILURES_BEFORE_FALLBACK) return;
      lmAvailable = false;
      apply();
      for (const cb of failureListeners) cb();
    });
  }

  if (LM_ENABLED) {
    watchForFailure(topo);
    watchForFailure(orto);
  }
  apply();

  return {
    layers: [fallback, topo, orto],
    getActive: () => active,
    setActive(id) {
      if (id === active) return;
      active = id;
      apply();
      for (const cb of changeListeners) cb(id);
    },
    isLmAvailable: () => lmAvailable,
    onLmFailure(cb) {
      failureListeners.push(cb);
    },
    onChange(cb) {
      changeListeners.push(cb);
    },
  };
}
