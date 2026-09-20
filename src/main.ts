/**
 * Landningsvyns entry. Håll den här vägen lätt (A4, NFK-02):
 * inga tunga bibliotek utöver OpenLayers-kärnan och proj4.
 */
import 'ol/ol.css';
import './style.css';
import { BASE, IS_DEV, LM_ENABLED } from './config/site.ts';
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

// Origo (verktygsläget) är ~590 kB brotli och laddas aldrig här (TK-05). Men när användaren
// visar avsikt att gå dit förhämtar vi scriptet, så att /verktyg känns omedelbar (A4).
const navVerktyg = document.getElementById('nav-verktyg');
if (navVerktyg) {
  let prefetched = false;
  const prefetch = (): void => {
    if (prefetched) return;
    prefetched = true;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = `${BASE}vendor/origo-2.10.0/js/origo.min.js`;
    document.head.appendChild(link);
  };
  navVerktyg.addEventListener('pointerenter', prefetch, { once: true });
  navVerktyg.addEventListener('focus', prefetch, { once: true });
  navVerktyg.addEventListener('touchstart', prefetch, { once: true, passive: true });
}
