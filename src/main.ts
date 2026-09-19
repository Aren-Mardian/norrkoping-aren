/**
 * Landningsvyns entry. Håll den här vägen lätt (A4, NFK-02):
 * inga tunga bibliotek utöver OpenLayers-kärnan och proj4.
 */
import 'ol/ol.css';
import './style.css';
import { LM_ENABLED } from './config/site.ts';
import { initI18n, t } from './i18n/index.ts';
import { createMap } from './map/createMap.ts';
import { showDevBanner, showMapStatus } from './ui/notices.ts';

initI18n();

const target = document.getElementById('map');
if (!target) throw new Error('Kartcontainern #map saknas i dokumentet');

const app = createMap(target);

if (!LM_ENABLED) {
  showDevBanner(t('dev.noToken'));
}

app.basemaps.onLmFailure(() => showMapStatus(t('map.status.fallback')));
