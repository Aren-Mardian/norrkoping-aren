/**
 * Bakgrundskartor (FK-01, FK-02) med graciös degradering (NFK-25, A5).
 *
 *  - topo:     Lantmäteriets topografiska webbkarta som självhostad PMTiles i EPSG:3006
 *              (utsnitt av "Topografisk webbkarta Nedladdning, raster", ADR-09). Ingen token.
 *  - orto:     Lantmäteriets flygbild via tile-proxyn (kräver appkonto på edge, IK-01).
 *  - fallback: OpenStreetMap i EPSG:3857, reprojicerad av OpenLayers. Används bara om
 *              PMTiles-filen saknas (t.ex. lokalt innan tools/extract_topowebb.py körts)
 *              eller slutar svara.
 *  - dark:     ingen bakgrund, mörk yta — för egna lager med hög kontrast.
 */
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { API_BASE, BASE, LM_ENABLED, PROXY_AVAILABLE } from '../config/site.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import { t } from '../i18n/index.ts';
import { createPmtilesBasemap } from './pmtilesSource.ts';

export type BasemapId = 'topo' | 'orto' | 'dark';

/** Varför topo-lagret inte kan visas. */
export type TopoFailure = 'missing' | 'errors';

export interface Basemaps {
  readonly layers: readonly TileLayer<XYZ>[];
  getActive(): BasemapId;
  setActive(id: BasemapId): void;
  /** Sant när den självhostade topografiska kartan kan användas. */
  isTopoAvailable(): boolean;
  /** Sant när Lantmäteriets proxy (flygbild) är konfigurerad. */
  isLmAvailable(): boolean;
  /** Anropas en gång om topo-kartan inte går att visa och fallback tar över. */
  onTopoFailure(cb: (reason: TopoFailure) => void): void;
  onChange(cb: (id: BasemapId) => void): void;
}

/** Självhostad PMTiles-fil; serveras av Vite-pluginen lokalt och som statisk fil i produktion. */
export const TOPO_PMTILES_URL = `${BASE}data/topowebb-farg.pmtiles`;

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

function proxyLayer(layer: 'topowebb' | 'ortofoto'): TileLayer<XYZ> {
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
  // Edge-proxyn finns alltid i produktion/preview, och den behöver inget appkonto för OSM.
  // Bara `npm run dev` (ingen proxy) går direkt mot OSM — CSP:n gäller inte där.
  // I produktion skulle en direkt-URL blockeras av CSP (img-src 'self') → tom karta.
  const url = PROXY_AVAILABLE
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
  const pmtiles = createPmtilesBasemap(TOPO_PMTILES_URL, t('attribution.lantmateriet'));
  const topo = new TileLayer({ visible: false, source: pmtiles.source });
  const orto = proxyLayer('ortofoto');
  const fallback = fallbackLayer();

  let active: BasemapId = 'topo';
  let topoAvailable = true;
  const lmAvailable = LM_ENABLED;
  const failureListeners: Array<(reason: TopoFailure) => void> = [];
  const changeListeners: Array<(id: BasemapId) => void> = [];

  function apply(): void {
    topo.setVisible(active === 'topo' && topoAvailable);
    orto.setVisible(active === 'orto' && lmAvailable);
    fallback.setVisible((active === 'topo' && !topoAvailable) || (active === 'orto' && !lmAvailable));
  }

  function failTopo(reason: TopoFailure): void {
    if (!topoAvailable) return;
    topoAvailable = false;
    apply();
    for (const cb of failureListeners) cb(reason);
  }

  // Saknas filen helt (404) faller vi tillbaka direkt, utan att vänta på tile-fel.
  pmtiles.ready.catch(() => failTopo('missing'));

  // Går filen sönder under körning: räkna fel tills första lyckade rutan.
  let errors = 0;
  let succeeded = false;
  pmtiles.source.on('tileloadend', () => {
    succeeded = true;
  });
  pmtiles.source.on('tileloaderror', () => {
    errors += 1;
    if (!succeeded && errors >= FAILURES_BEFORE_FALLBACK) failTopo('errors');
  });

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
    isTopoAvailable: () => topoAvailable,
    isLmAvailable: () => lmAvailable,
    onTopoFailure(cb) {
      failureListeners.push(cb);
    },
    onChange(cb) {
      changeListeners.push(cb);
    },
  };
}
