/**
 * Origo-konfiguration för verktygsläget (kravspec Kärnfunktion C, FK-22–FK-31, ADR-02, ADR-11).
 *
 * Konfigurationen byggs som ett objekt — inte JSON — så att projektioner, upplösningar och
 * kommunens utbredning kommer från exakt samma källa som landningsvyn (shared/geo/*).
 * Kartan står i EPSG:3006 (ADR-03) med Lantmäteriets tile-matris; bakgrundskartan kopplas in
 * efter init via PMTiles-läsaren (se main.ts), eftersom Origos XYZ-lager bara kan ta en URL.
 */
import { KOMMUN_VIEW_BBOX_3006, PAN_LIMIT_3006 } from '../../shared/geo/kommun.ts';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { DEF_3006, DEF_3010, EXTENT_3006 } from '../../shared/geo/crs.ts';
import { API_BASE, BASE, KOMMUNGRANS_URL } from '../config/site.ts';

export const ORIGO_VERSION = '2.10.0';
export const ORIGO_DIR = `${BASE}vendor/origo-${ORIGO_VERSION}/`;
export const ORIGO_SCRIPT = `${ORIGO_DIR}js/origo.min.js`;
export const ORIGO_CSS = `${ORIGO_DIR}css/style.css`;

/** Lagernamnet i Origo vars källa byts ut mot PMTiles-läsaren efter init. */
export const TOPO_LAYER_NAME = 'topowebb';

/** Flygbildslagren (FK-02): Lantmäteriets rikstäckande referensårsmosaiker, via vår proxy. */
export const ORTO_LAYERS = [
  { name: 'orto1960', layerId: 'histortho60', year: 1960, titleKey: 'ortoTitle60' },
  { name: 'orto1975', layerId: 'histortho75', year: 1975, titleKey: 'ortoTitle75' },
] as const;

const t = {
  background: 'Bakgrundskartor',
  topoTitle: 'Topografisk webbkarta',
  topoAbstract:
    '<p><b>Källa:</b> Topografisk webbkarta Nedladdning, raster — © Lantmäteriet, CC BY 4.0. ' +
    'Informationen har bearbetats: utsnitt över Norrköpings kommun, ompaketerad till PMTiles.</p>' +
    '<p><b>Referenssystem:</b> SWEREF 99 TM (EPSG:3006). <b>Aktualitet:</b> Lantmäteriets fil 2026-06-22, utsnitt 2026-09-19.</p>',
  boundaryTitle: 'Kommungräns',
  boundaryAbstract:
    '<p><b>Källa:</b> Kommun, län och rike — © Lantmäteriet, CC BY 4.0, hämtad via STAC-API:et 2026-09-23. ' +
    'Kommunkod 0581, administrativ gräns i SWEREF 99 TM.</p>',
  ortoTitle60: 'Flygbild 1960',
  ortoTitle75: 'Flygbild 1975',
  ortoAbstract:
    '<p><b>Källa:</b> Ortofoto historiska Visning (WMS) — © Lantmäteriet, CC0. Rikstäckande ortofotomosaik med ' +
    'referensår {year}, upplösning 0,5 m, svartvit.</p>' +
    '<p>Hämtas ruta för ruta genom sajtens egen proxy (/api/tiles) — din webbläsare anropar aldrig Lantmäteriet ' +
    'direkt och ingen hemlighet finns i klienten. <b>Referenssystem:</b> SWEREF 99 TM (EPSG:3006), ' +
    'Lantmäteriets tile-matris t.o.m. nivå 13.</p>',
  aboutButton: 'Om verktygen',
  aboutTitle: 'Om verktygsläget',
  aboutContent:
    '<p>Verktygsläget är byggt med <a href="https://github.com/origo-map/origo" target="_blank" rel="noopener">Origo</a> ' +
    `(version ${ORIGO_VERSION}, BSD 2-clause) — det öppna kartramverk som svenska kommuner använder — ovanpå OpenLayers.</p>` +
    '<p>Kartan visas och mäts i <b>SWEREF 99 TM (EPSG:3006)</b>. Längd och area beräknas geodetiskt, aldrig planärt i Web Mercator. ' +
    'Koordinater kan läsas av i SWEREF 99 TM, SWEREF 99 16 30 och WGS 84.</p>' +
    '<p>Ritade objekt exporteras som GeoJSON i WGS 84 (RFC 7946). Filer du släpper på kartan läses enbart lokalt i webbläsaren och laddas aldrig upp.</p>' +
    '<p><b>Höjd:</b> markhöjd och höjdprofil hämtas från Lantmäteriets <i>Markhöjd Direkt</i> i RH 2000, ' +
    'via sajtens egen proxy. Profilen mäts längs den ritade linjen med jämnt fördelade punkter.</p>' +
    '<p><b>Datakällor:</b> Topografisk webbkarta Nedladdning, raster och Ortofoto historiska Visning © Lantmäteriet ' +
    '(CC BY 4.0, bearbetad). Kommungräns ur Kommun, län och rike © Lantmäteriet. Ortnamn © Lantmäteriet. ' +
    'Markhöjd Direkt © Lantmäteriet.</p>' +
    '<p><i>Ett oberoende projekt av Aren Mardian. Inte en officiell tjänst från Norrköpings kommun.</i></p>',
  positionTitle: 'SWEREF 99 TM',
  backLink: 'Till Norrköpingskartan',
  printTitle: 'Norrköpingskartan',
  dropGroup: 'Egna filer',
} as const;

/** Origo tar ett konfigobjekt (loadresources.js: typeof mapOptions === 'object'). */
export function buildOrigoConfig(targetId: string, view: { center: number[]; zoom: number }): Record<string, unknown> {
  const localeId = 'sv-SE';

  return {
    target: `#${targetId}`,
    svgSpritePath: `${ORIGO_DIR}css/svg/`,
    // Origo lägger sina standardkontroller UTÖVER listan nedan (och dubblerar dem); vi listar allt själva.
    defaultControls: [],

    // ── Referenssystem (ADR-03, Bilaga B) ───────────────────────────────────
    projectionCode: 'EPSG:3006',
    projectionExtent: [...EXTENT_3006],
    proj4Defs: [
      { code: 'EPSG:3006', alias: 'SWEREF 99 TM', projection: DEF_3006 },
      { code: 'EPSG:3010', alias: 'SWEREF 99 16 30', projection: DEF_3010 },
    ],
    // Panorering begränsad till kommunen + 25 km (FK-04); zoomsteg = Lantmäteriets matris.
    extent: [...PAN_LIMIT_3006],
    // Vyn ärvs från kartan användaren redan tittade på (ADR-15) — inget hopp när verktygen slås på.
    center: [...view.center],
    zoom: view.zoom,
    resolutions: [...LM_3006_RESOLUTIONS],
    constrainResolution: false,

    featureinfoOptions: { infowindow: 'overlay' },

    // ── Kontroller (FK-23–FK-31) ────────────────────────────────────────────
    controls: [
      { name: 'localization', options: { localeId, fallbackLocaleId: 'sv-SE', showLocMenu: false } },
      { name: 'home', options: { extent: [...KOMMUN_VIEW_BBOX_3006], zoomOnStart: false } },
      { name: 'mapmenu', options: { isActive: false } },
      { name: 'zoom' },
      { name: 'rotate' },
      { name: 'scaleline' },
      { name: 'attribution' },
      { name: 'fullscreen' },
      { name: 'legend', options: { expanded: true, useGroupIndication: true, labelOpacitySlider: 'Opacitet' } },
      // FK-26: koordinatavläsning i minst 3006, 3010 och WGS 84 (decimalgrader + grader-minuter-sekunder).
      {
        name: 'position',
        options: {
          // `title` lägger kartans projektion (3006) först i listan.
          title: t.positionTitle,
          projections: [
            { projectionCode: 'EPSG:3010', projectionLabel: 'SWEREF 99 16 30', precision: 1 },
            { projectionCode: 'EPSG:4326', projectionLabel: 'WGS 84', precision: 5 },
            { projectionCode: 'EPSG:4326', projectionLabel: 'WGS 84 (DMS)', dms: true, precision: 2 },
          ],
        },
      },
      // FK-23/24/25: längd, area, buffert; delsträckor visas. Höjd kopplas på när Markhöjd Direkt finns.
      {
        name: 'measure',
        options: {
          default: 'length',
          measureTools: ['length', 'area', 'buffer'],
          showSegmentLengths: true,
          showSegmentLabelButtonActive: true,
          useHectare: true,
          snap: true,
          snapRadius: 15,
        },
      },
      // FK-27: rita punkt/linje/yta/text och ladda ned som GeoJSON (WGS 84).
      { name: 'draw', options: { showDownloadButton: true, showAttributeButton: true, multipleLayers: true } },
      // FK-28: dela vy, lager och ritade objekt som länk (bara klientstate i URL:en).
      { name: 'sharemap' },
      // FK-29: utskrift med skalstock, norrpil, titel och attribution.
      {
        name: 'print',
        options: {
          headerText: t.printTitle,
          showScale: true,
          showNorthArrow: true,
          northArrow: { src: `${ORIGO_DIR}css/png/north_arrow_print.png` },
          logo: { src: `${BASE}favicon.svg`, cls: 'o-print-logo' },
          showCreated: true,
          leftFooterText: '© Lantmäteriet (CC BY 4.0) · © OpenStreetMap-bidragsgivare (ODbL)',
          sizes: { a3: [420, 297], a4: [297, 210], custom: [] },
          sizeInitial: 'a4',
          orientation: 'landscape',
          resolutions: [{ label: '75 dpi', value: 75 }, { label: '150 dpi', value: 150 }, { label: '300 dpi', value: 300 }],
          resolution: 150,
        },
      },
      // FK-31: släpp GeoJSON/GPX/KML på kartan — läses lokalt, laddas aldrig upp.
      { name: 'draganddrop', options: { groupTitle: t.dropGroup, zoomToExtent: true, showLegendButton: true } },
      // FK-06 i verktygsläget: min position, bara på användarens begäran.
      { name: 'geoposition' },
      { name: 'about', options: { buttonText: t.aboutButton, title: t.aboutTitle, content: t.aboutContent } },
    ],

    // Origos sidfot hyser positionskontrollen (FK-26); friskrivningen (JK-04) står i vår egen sidfot.
    pageSettings: {
      footer: {},
      mapGrid: { visible: false },
    },

    // ── Lager (FK-30: metadata per lager kommer från konfigurationen, inte hårdkodad text) ──
    source: {
      // Tom URL: rutorna hämtas av PMTiles-läsaren som kopplas in efter init (main.ts).
      // transition: 0 — ingen intoning av rutor: färre ramar (NFK-05) och rutorna syns direkt
      // även när webbläsaren strypt requestAnimationFrame.
      'topowebb-pmtiles': { url: '', transition: 0 },
      // Flygbilderna går via vår proxy. transition: 0 av samma skäl som ovan — utan det fastnar
      // rutorna i Origos intoning och lagret ser tomt ut trots att rutorna hämtats (ADR-11).
      ...Object.fromEntries(
        ORTO_LAYERS.map(({ name, layerId }) => [`${name}-src`, { url: `${API_BASE}/tiles/${layerId}/{z}/{y}/{x}.jpg`, transition: 0 }]),
      ),
    },
    groups: [{ name: 'background', title: t.background, expanded: true }],
    // Origo ritar första lagret i listan överst — bakgrundskartan sist.
    layers: [
      {
        name: 'kommungrans',
        title: t.boundaryTitle,
        group: 'root',
        type: 'GEOJSON',
        source: KOMMUNGRANS_URL,
        projection: 'EPSG:4326',
        style: 'kommungrans',
        attribution: '© Lantmäteriet (CC BY 4.0)',
        abstract: t.boundaryAbstract,
        queryable: false,
        visible: true,
        opacity: 1,
      },
      // Flygbilderna ligger i bakgrundsgruppen, avslagna från start: de kostar nätverk först när
      // användaren tänder dem, och landningsvyns budget påverkas inte alls (TK-05).
      ...ORTO_LAYERS.map(({ name, year, titleKey }) => ({
        name,
        title: t[titleKey],
        group: 'background',
        type: 'XYZ',
        source: `${name}-src`,
        tileGrid: {
          extent: [...LM_3006_EXTENT],
          origin: [...LM_3006_ORIGIN],
          resolutions: LM_3006_RESOLUTIONS.slice(0, 14),
          tileSize: [LM_TILE_SIZE, LM_TILE_SIZE],
        },
        maxZoom: 13,
        attribution: `© Lantmäteriet, historiska ortofoton ${year}`,
        abstract: t.ortoAbstract.replace('{year}', String(year)),
        queryable: false,
        visible: false,
      })),
      {
        name: TOPO_LAYER_NAME,
        title: t.topoTitle,
        group: 'background',
        type: 'XYZ',
        source: 'topowebb-pmtiles',
        tileGrid: {
          extent: [...LM_3006_EXTENT],
          origin: [...LM_3006_ORIGIN],
          resolutions: [...LM_3006_RESOLUTIONS],
          tileSize: [LM_TILE_SIZE, LM_TILE_SIZE],
        },
        attribution: '© Lantmäteriet, CC BY 4.0',
        abstract: t.topoAbstract,
        queryable: false,
        visible: true,
      },
    ],
    styles: {
      // En regel med två delar: halo under, streckad linje ovanpå (samma som landningsvyn).
      kommungrans: [
        [
          { stroke: { color: 'rgba(255,255,255,0.75)', width: 5 } },
          { stroke: { color: '#7b2cbf', width: 2, lineDash: [8, 4] } },
        ],
      ],
    },
  };
}
