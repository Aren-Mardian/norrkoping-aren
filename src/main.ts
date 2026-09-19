/**
 * Landningsvyns entry. Håll den här vägen lätt (A4, NFK-02):
 * inga tunga bibliotek utöver OpenLayers-kärnan och proj4.
 */
import 'ol/ol.css';
import './style.css';
import { IS_DEV, LM_ENABLED } from './config/site.ts';
import { initI18n, t } from './i18n/index.ts';
import { createMap } from './map/createMap.ts';
import { showDevBanner, showMapStatus } from './ui/notices.ts';

initI18n();

const target = document.getElementById('map');
if (!target) throw new Error('Kartcontainern #map saknas i dokumentet');

const app = createMap(target);

// FK-33: utvecklingsbanner bara lokalt. I produktion är saknat appkonto ingen nyhet för
// besökaren — flygbildsknappen är avstängd, inget mer.
if (IS_DEV && !LM_ENABLED) {
  showDevBanner(t('dev.noToken'));
}

// NFK-25: saknas den självhostade bakgrundskartan (eller slutar den svara) visas OSM med notis.
app.basemaps.onTopoFailure((reason) => {
  if (IS_DEV && reason === 'missing') showDevBanner(t('dev.noTiles'));
  showMapStatus(t('map.status.fallback'));
});
