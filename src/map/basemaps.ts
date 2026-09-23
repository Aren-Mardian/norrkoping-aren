/**
 * Bakgrundskartor (FK-01, FK-02) med graciös degradering (NFK-25, A5).
 *
 *  - topo:     Lantmäteriets topografiska webbkarta som självhostad PMTiles i EPSG:3006
 *              (utsnitt av "Topografisk webbkarta Nedladdning, raster", ADR-09). Ingen token.
 *  - orto:     Lantmäteriets historiska ortofoton via tile-proxyn (kräver appkonto på edge, IK-01).
 *              Två rikstäckande referensårsmosaiker täcker kommunen: 1960 och 1975. Årtalet byts
 *              utan att något annat lager laddas om — bara den aktiva årgångens rutor hämtas.
 *  - fallback: OpenStreetMap i EPSG:3857, reprojicerad av OpenLayers. Används bara om
 *              PMTiles-filen saknas (t.ex. lokalt innan tools/extract_topowebb.py körts)
 *              eller slutar svara.
 *  - dark:     samma topografiska karta, inverterad och dämpad med ett CSS-filter på
 *              lagrets canvas (GPU-kompositerat, inga extra rutor eller anrop). Ger en
 *              mörk, neutral bakgrund där egna lager får hög kontrast (FK-02, FK-36).
 */
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { API_BASE, PROXY_AVAILABLE, TOPO_PMTILES_URL } from '../config/site.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import { t } from '../i18n/index.ts';
import { createPmtilesBasemap } from './pmtilesSource.ts';

export type BasemapId = 'topo' | 'orto' | 'dark';

/** Flygbildens årgång (FK-02). Lagren är Lantmäteriets referensårsmosaiker. */
export type OrtoYear = 1960 | 1975;
export const ORTO_YEARS: readonly OrtoYear[] = [1960, 1975];
const ORTO_LAYER_ID: Record<OrtoYear, string> = { 1960: 'histortho60', 1975: 'histortho75' };

/** Varför topo-lagret inte kan visas. */
export type TopoFailure = 'missing' | 'errors';

export interface Basemaps {
  readonly layers: readonly TileLayer<XYZ>[];
  getActive(): BasemapId;
  setActive(id: BasemapId): void;
  /** Sant när den självhostade topografiska kartan kan användas. */
  isTopoAvailable(): boolean;
  getOrtoYear(): OrtoYear;
  setOrtoYear(year: OrtoYear): void;
  /**
   * Sant så länge flygbilden kan visas. Avgörs av om proxyn finns — inte av en byggflagga —
   * och slås av först om Lantmäteriet faktiskt vägrar leverera rutor (ADR-16).
   */
  isLmAvailable(): boolean;
  /** Anropas en gång om topo-kartan inte går att visa och fallback tar över. */
  onTopoFailure(cb: (reason: TopoFailure) => void): void;
  /** Anropas en gång om flygbilden inte går att hämta (t.ex. appkonto saknas på servern). */
  onOrtoFailure(cb: () => void): void;
  onChange(cb: (id: BasemapId) => void): void;
}

/** Efter så många misslyckade rutor utan en enda lyckad byter vi till fallback. */
const FAILURES_BEFORE_FALLBACK = 4;
/** Samma spärr för flygbilden: några enstaka fel kan vara en trasig ruta, inte en trasig tjänst. */
const ORTO_FAILURES_BEFORE_DISABLE = 4;

/** `levels` = antal nivåer i rutnätet. Slutar rutnätet vid tjänstens sista nivå skalar
 *  OpenLayers upp den sista rutan i stället för att visa tomt när man zoomar vidare. */
function lmTileGrid(levels = LM_3006_RESOLUTIONS.length): TileGrid {
  return new TileGrid({
    extent: [...LM_3006_EXTENT],
    origin: [...LM_3006_ORIGIN],
    resolutions: LM_3006_RESOLUTIONS.slice(0, levels),
    tileSize: LM_TILE_SIZE,
  });
}

/** Sista zoomnivå Lantmäteriets ortofoto-WMS levererar. */
const ORTO_MAX_ZOOM = 13;

/** Flygbild: Lantmäteriets historiska ortofoton via proxyn, som gör WMS GetMap per ruta. */
function ortoLayer(year: OrtoYear): TileLayer<XYZ> {
  return new TileLayer({
    visible: false,
    source: new XYZ({
      url: `${API_BASE}/tiles/${ORTO_LAYER_ID[year]}/{z}/{y}/{x}.jpg`,
      projection: EPSG_3006,
      // Rutnätet slutar på tjänstens sista nivå. Utan det försvann flygbilden helt så fort man
      // zoomade förbi nivå 13 — nu skalas nivå 13 upp i stället (verifierat 2026-09-23).
      tileGrid: lmTileGrid(ORTO_MAX_ZOOM + 1),
      attributions: t('attribution.lantmateriet.orto').replace('{year}', String(year)),
      transition: 0,
    }),
  });
}

function fallbackLayer(): TileLayer<XYZ> {
  // Samma klass som topo så att mörkt läge fungerar även på fallbacken.
  // Edge-proxyn finns alltid i produktion/preview, och den behöver inget appkonto för OSM.
  // Bara `npm run dev` (ingen proxy) går direkt mot OSM — CSP:n gäller inte där.
  // I produktion skulle en direkt-URL blockeras av CSP (img-src 'self') → tom karta.
  const url = PROXY_AVAILABLE
    ? `${API_BASE}/tiles/osm/{z}/{y}/{x}.png`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return new TileLayer({
    visible: false,
    className: 'ol-layer ol-layer-topo',
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
  // Egen klass på lagrets element så att mörkt läge kan filtrera just den här canvasen.
  const topo = new TileLayer({ visible: false, source: pmtiles.source, className: 'ol-layer ol-layer-topo' });
  // Ett lager per årgång: att byta år blir en synlighetsväxling, och redan hämtade rutor
  // ligger kvar i OL:s cache så att man kan jämföra 1960/1975 utan ny nedladdning.
  const ortoLayers = new Map<OrtoYear, TileLayer<XYZ>>(ORTO_YEARS.map((y) => [y, ortoLayer(y)]));
  const fallback = fallbackLayer();

  let active: BasemapId = 'topo';
  let ortoYear: OrtoYear = ORTO_YEARS[0] ?? 1960;
  let topoAvailable = true;
  // Flygbilden går genom vår egen proxy. Finns proxyn (allt utom ren `npm run dev` utan .env)
  // antar vi att den fungerar och låter knappen vara påslagen; svarar Lantmäteriet inte stängs
  // den av i efterhand med en synlig förklaring. Tidigare avgjordes det av byggflaggan
  // VITE_LM_ENABLED, vilket gjorde knappen död på varje bygge där variabeln saknades (ADR-16).
  let lmAvailable = PROXY_AVAILABLE;
  const failureListeners: Array<(reason: TopoFailure) => void> = [];
  const changeListeners: Array<(id: BasemapId) => void> = [];
  const ortoFailureListeners: Array<() => void> = [];

  function apply(): void {
    const wantsTopo = active === 'topo' || active === 'dark';
    topo.setVisible(wantsTopo && topoAvailable);
    for (const [year, layer] of ortoLayers) layer.setVisible(active === 'orto' && lmAvailable && year === ortoYear);
    fallback.setVisible((wantsTopo && !topoAvailable) || (active === 'orto' && !lmAvailable));
  }

  function failTopo(reason: TopoFailure): void {
    if (!topoAvailable) return;
    topoAvailable = false;
    apply();
    for (const cb of failureListeners) cb(reason);
  }

  /** Flygbilden svarar inte: stäng av knappen, förklara, och gå tillbaka till kartan. */
  function failOrto(): void {
    if (!lmAvailable) return;
    lmAvailable = false;
    if (active === 'orto') active = 'topo';
    apply();
    for (const cb of ortoFailureListeners) cb();
    for (const cb of changeListeners) cb(active);
  }

  let ortoErrors = 0;
  let ortoSucceeded = false;
  for (const layer of ortoLayers.values()) {
    const source = layer.getSource();
    source?.on('tileloadend', () => {
      ortoSucceeded = true;
    });
    source?.on('tileloaderror', () => {
      ortoErrors += 1;
      if (!ortoSucceeded && ortoErrors >= ORTO_FAILURES_BEFORE_DISABLE) failOrto();
    });
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
    layers: [fallback, topo, ...ortoLayers.values()],
    getActive: () => active,
    setActive(id) {
      if (id === active) return;
      active = id;
      apply();
      for (const cb of changeListeners) cb(id);
    },
    isTopoAvailable: () => topoAvailable,
    isLmAvailable: () => lmAvailable,
    getOrtoYear: () => ortoYear,
    setOrtoYear(year) {
      if (year === ortoYear) return;
      ortoYear = year;
      apply();
      for (const cb of changeListeners) cb(active);
    },
    onTopoFailure(cb) {
      failureListeners.push(cb);
    },
    onOrtoFailure(cb) {
      ortoFailureListeners.push(cb);
    },
    onChange(cb) {
      changeListeners.push(cb);
    },
  };
}
