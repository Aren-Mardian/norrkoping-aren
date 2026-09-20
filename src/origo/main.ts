/**
 * Verktygsläget (Kärnfunktion C, FK-22): en egen sida som laddar Origo först när användaren
 * är här. Landningsvyn importerar aldrig något härifrån (TK-05, ADR-02).
 *
 * Laddordning, med prestanda i åtanke:
 *  1. Sidans skal ritas direkt (topbar, statusrad, tom kartyta med skelett).
 *  2. Origo (~590 kB brotli) laddas som klassiskt script från egen origin; CSS:en ligger som
 *     <link> i HTML:en så att den hämtas parallellt.
 *  3. Origo initieras med ett konfigobjekt byggt från samma geodata-konstanter som landningsvyn.
 *  4. Efter 'load' byts det tomma XYZ-lagrets laddfunktion mot PMTiles-läsaren (ADR-09) —
 *     samma kod som landningsvyn, men mot Origos egen OpenLayers-instans.
 */
import '../style.css';
import './origo.css';
import { BASE, IS_DEV, TOPO_PMTILES_URL } from '../config/site.ts';
import { initI18n, t } from '../i18n/index.ts';
import { createPmtilesTileLoader, type ImageTileLike } from '../map/pmtilesLoader.ts';
import { initLangToggle } from '../ui/chrome.ts';
import { ORIGO_SCRIPT, TOPO_LAYER_NAME, buildOrigoConfig } from './origoConfig.ts';

const lang = initI18n();
initLangToggle();

const status = document.getElementById('origo-status');
const wrapper = document.getElementById('app-wrapper');

function showStatus(message: string): void {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.addEventListener('load', () => resolve(), { once: true });
    el.addEventListener('error', () => reject(new Error(`Kunde inte ladda ${src}`)), { once: true });
    document.head.appendChild(el);
  });
}

/** Kopplar PMTiles-läsaren till Origos XYZ-lager. Origos OL delar inte instans med vår, men tile-API:et är detsamma. */
function attachBasemap(viewer: OrigoViewer): void {
  const layer = viewer.getLayer(TOPO_LAYER_NAME);
  if (!layer) {
    showStatus(t('origo.status.noBasemap'));
    return;
  }
  const source = layer.getSource();
  const map = viewer.getMap();
  const loader = createPmtilesTileLoader(TOPO_PMTILES_URL, t('attribution.lantmateriet'));
  source.setTileUrlFunction(loader.tileUrlFunction);
  source.setTileLoadFunction((tile, src) => loader.tileLoadFunction(tile as ImageTileLike, src));
  // Källan byts efter att Origo redan ritat första ramen; rutor som blir klara i efterhand
  // triggar annars ingen omritning. OL sammanför anropen till en ritning per frame.
  source.on('tileloadend', () => map.render());
  source.refresh();
  loader.ready
    .then((info) => source.setAttributions(info.attribution))
    .catch(() => showStatus(t('origo.status.noBasemap')));
}

async function boot(): Promise<void> {
  if (!wrapper) throw new Error('#app-wrapper saknas');
  try {
    await loadScript(ORIGO_SCRIPT);
  } catch {
    showStatus(t('origo.status.loadFailed'));
    return;
  }
  const Origo = window.Origo;
  if (!Origo) {
    showStatus(t('origo.status.loadFailed'));
    return;
  }

  // Origo lägger alltid till <base href={baseUrl}>. Sidans egen katalog ändrar inget i hur relativa
  // URL:er löses, och CSP:n för /origo/ tillåter base-uri 'self' (meta, ADR-12).
  const origo = Origo(buildOrigoConfig(lang), { baseUrl: `${BASE}origo/` });
  origo.on('load', (viewer) => {
    wrapper.classList.add('is-ready');
    attachBasemap(viewer);
    // Felsökningshandtag lokalt — aldrig i produktion.
    if (IS_DEV) (window as unknown as { __origo?: unknown }).__origo = { origo, viewer };
  });
}

void boot();
