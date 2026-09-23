/**
 * Landningsvyns entry. Håll den här vägen lätt (A4, NFK-02):
 * inga tunga bibliotek utöver OpenLayers-kärnan och proj4.
 *
 * Ordning: karta först (LCP), sedan badplatsernas grunddata (statisk, 2 kB gzip), sedan
 * status från edge (IK-02). Väder hämtas först när en badplats öppnas (FK-18).
 */
import 'ol/ol.css';
import './style.css';
import './panel.css';
import { createBadLayer } from './bad/layer.ts';
import { loadBadplatser, loadStatus, merge } from './bad/model.ts';
import { createPanel } from './bad/panel.ts';
import { BASE, IS_DEV, LM_ENABLED } from './config/site.ts';
import { initI18n, t } from './i18n/index.ts';
import { createMap } from './map/createMap.ts';
import { createPlatsmarkor } from './map/platsmarkor.ts';
import { createSok } from './sok/panel.ts';
import { fillFooterFacts, initLangToggle, placeFooter } from './ui/chrome.ts';
import { showDevBanner, showMapStatus } from './ui/notices.ts';
import { createSheet } from './ui/sheet.ts';

initI18n();
initLangToggle();
fillFooterFacts();
placeFooter(document.getElementById('panel-body'));

const target = document.getElementById('map');
if (!target) throw new Error('Kartcontainern #map saknas i dokumentet');

const app = createMap(target);
// Felsökningshandtag lokalt — aldrig i produktion.
if (IS_DEV) (window as unknown as { __app?: unknown }).__app = app;

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

// ── Ortnamnssök (FK-32) + markhöjd (IK-08) ────────────────────────────────────
// Sökrutan ligger över kartan; motorn och indexet hämtas först när användaren söker (TK-05).
const sokHost = document.getElementById('sok-host');
if (sokHost) {
  const markor = createPlatsmarkor(app.map, sokHost.parentElement ?? sokHost);
  createSok(sokHost, {
    onPick(traff) {
      // Zooma till LM-nivå 11 (~10 m/px) — nära nog för att se platsen, utan att gissa skala.
      app.zoomTo([traff.e, traff.n], 11);
      markor.show(traff);
    },
  });
}

// ── Badplatser (Kärnfunktion B) ───────────────────────────────────────────────
const panelEl = document.getElementById('panel');
const handleEl = document.getElementById('panel-handle');
if (panelEl && handleEl instanceof HTMLButtonElement) {
  handleEl.dataset['labelExpand'] = t('panel.handleExpand');
  handleEl.dataset['labelCollapse'] = t('panel.handleCollapse');
  const sheet = createSheet(panelEl, handleEl);
  const badLayer = createBadLayer(app.map);
  app.map.addLayer(badLayer.layer);

  let selectedId: string | null = null;
  const panel = createPanel(panelEl, {
    onSelect: (id) => select(id, true),
    onHover: (id) => badLayer.setHover(id),
  });

  /**
   * Hur mycket av kartan sheeten täcker efter valet (mobil): peek öppnas till half, annars gäller
   * nuvarande läge. Kartan slutar redan ovanför peek-höjden (panel.css), så bara överskottet räknas.
   */
  const sheetInset = (): number => {
    if (sheet.isDesktop()) return 0;
    const layoutH = panelEl.parentElement?.clientHeight ?? 0;
    const mapH = target.clientHeight;
    const sheetH = layoutH * (sheet.get() === 'full' ? 0.92 : 0.56);
    return Math.max(0, Math.round(sheetH - (layoutH - mapH)));
  };

  function select(id: string | null, fromList: boolean): void {
    selectedId = id;
    badLayer.setSelected(id);
    panel.setSelected(id);
    const feature = id ? badLayer.getFeature(id) : undefined;
    if (feature) {
      const geom = feature.getGeometry();
      if (geom) app.zoomTo(geom.getCoordinates(), 11, sheetInset());
      if (!fromList) sheet.reveal();
    } else if (!fromList && !sheet.isDesktop()) {
      // Klick på tom karta på mobil: ge kartan plats igen.
      sheet.set('peek');
    }
  }

  badLayer.onSelect((id) => select(id, false));
  badLayer.onHover((id) => panel.setHover(id));

  // Escape stänger detaljvyn (UX-03).
  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedId) select(null, true);
  });

  void (async () => {
    try {
      const collection = await loadBadplatser();
      const data = merge(collection, null);
      badLayer.setSites(data.sites);
      panel.render(data);
      // Status i ett andra steg: listan syns direkt, statusen fylls på (A4).
      const status = await loadStatus();
      const withStatus = merge(collection, status);
      badLayer.setSites(withStatus.sites);
      panel.render(withStatus);
      if (selectedId) select(selectedId, true);
    } catch {
      showMapStatus(t('bad.status.unavailable'));
    }
  })();
}

// Origo-sidan (/origo/) är ~590 kB brotli och laddas aldrig här (TK-05). Men när användaren
// visar avsikt att gå dit förhämtar vi scriptet, så att sidan känns omedelbar (A4).
const navOrigo = document.getElementById('nav-origo');
if (navOrigo) {
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
  navOrigo.addEventListener('pointerenter', prefetch, { once: true });
  navOrigo.addEventListener('focus', prefetch, { once: true });
  navOrigo.addEventListener('touchstart', prefetch, { once: true, passive: true });
}
