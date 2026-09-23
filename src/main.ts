/**
 * Sidans entry. Håll den här vägen lätt (A4, NFK-02): inga tunga bibliotek utöver
 * OpenLayers-kärnan och proj4 — Origo hämtas först när användaren öppnar verktygen (ADR-15).
 *
 * Ordning: karta först (LCP), sedan badplatsernas grunddata (statisk, 2 kB gzip), sedan
 * status från edge (IK-02). Väder hämtas först när en badplats öppnas (FK-18).
 */
import 'ol/ol.css';
import './style.css';
import './panel.css';
import { createBadLayer, toXY } from './bad/layer.ts';
import { loadBadplatser, loadStatus, merge, type BadData } from './bad/model.ts';
import { createPanel } from './bad/panel.ts';
import { IS_DEV, LM_ENABLED } from './config/site.ts';
import { initI18n, t } from './i18n/index.ts';
import { createMap } from './map/createMap.ts';
import { createPlatsmarkor } from './map/platsmarkor.ts';
import { createSok } from './sok/panel.ts';
import { fillFooterFacts, placeFooter } from './ui/chrome.ts';
import { showDevBanner, showMapStatus } from './ui/notices.ts';
import { createPanelCollapse } from './ui/panelCollapse.ts';
import { createSheet } from './ui/sheet.ts';
import { createToolsController } from './ui/toolsToggle.ts';

initI18n();
fillFooterFacts();
placeFooter(document.getElementById('panel-body'));

const target = document.getElementById('map');
if (!target) throw new Error('Kartcontainern #map saknas i dokumentet');

const app = createMap(target);
// Felsökningshandtag lokalt — aldrig i produktion.
if (IS_DEV) (window as unknown as { __app?: unknown }).__app = app;

// FK-33: utvecklingsbanner bara lokalt. I produktion är saknat appkonto ingen nyhet för
// besökaren — flygbildsknappen är avstängd, inget mer.
if (IS_DEV && !LM_ENABLED) showDevBanner(t('dev.noToken'));

// NFK-25: saknas den självhostade bakgrundskartan (eller slutar den svara) visas OSM med notis.
app.basemaps.onTopoFailure((reason) => {
  if (IS_DEV && reason === 'missing') showDevBanner(t('dev.noTiles'));
  showMapStatus(t('map.status.fallback'));
});

// Flygbilden går via proxyn och kan sakna appkonto på servern — då sägs det rakt ut (ADR-16).
app.basemaps.onOrtoFailure(() => showMapStatus(t('map.status.ortoFailed')));

// ── Verktygsläget: Origo i samma kartruta, på begäran (ADR-15) ────────────────
const tools = createToolsController({
  ownMap: app,
  mount: document.getElementById('origo-mount'),
  mapElement: target,
  toggle: document.getElementById('verktyg-toggle'),
  hojdToggle: document.getElementById('hojd-toggle'),
  status: document.getElementById('tools-status'),
  onBasemapFailure: () => showMapStatus(t('map.status.fallback')),
});

// ── Ortnamnssök (FK-32) + markhöjd (IK-08) ────────────────────────────────────
// Sökrutan ligger över kartan och styr den karta som är aktiv; motorn och indexet hämtas
// först när användaren söker (TK-05).
const sokHost = document.getElementById('sok-host');
if (sokHost) {
  const markor = createPlatsmarkor(app.map, sokHost.parentElement ?? sokHost);
  createSok(sokHost, {
    onPick(traff) {
      const xy = [traff.e, traff.n];
      tools.zoomTo(xy, 11);
      // Nålen ritas i vår egen karta; i verktygsläget centreras kartan och kortet visar
      // koordinater och höjd — Origo har sina egna sätt att peka ut en punkt.
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
  createPanelCollapse(panelEl, () => app.map.updateSize());

  const badLayer = createBadLayer(app.map);
  let data: BadData | null = null;
  let selectedId: string | null = null;

  const panel = createPanel(panelEl, {
    onSelect: (id) => select(id, true),
    onHover: (id) => setHover(id),
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

  function setHover(id: string | null): void {
    badLayer.setHover(id);
    tools.setHover(id);
  }

  function select(id: string | null, fromList: boolean): void {
    selectedId = id;
    badLayer.setSelected(id);
    tools.setSelected(id);
    panel.setSelected(id);
    const xy = id ? badLayer.getCoordinates(id) : undefined;
    if (xy) {
      // Zooma till LM-nivå 11 (~10 m/px) i den karta som är aktiv.
      tools.zoomTo(xy, 11, sheetInset());
      if (!fromList) sheet.reveal();
    } else if (!fromList && !sheet.isDesktop()) {
      // Klick på tom karta på mobil: ge kartan plats igen.
      sheet.set('peek');
    }
  }

  badLayer.onSelect((id) => select(id, false));
  badLayer.onHover((id) => panel.setHover(id));
  tools.onMapSelect((id) => select(id, false));
  tools.onMapHover((id) => panel.setHover(id));

  // Verktygsläget får samma badplatser och samma markering som vår karta.
  tools.onReady((handle) => {
    if (data) handle.setSites(toXY(data.sites));
    handle.setSelected(selectedId);
  });

  // Escape stänger detaljvyn (UX-03).
  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedId) select(null, true);
  });

  void (async () => {
    try {
      const collection = await loadBadplatser();
      const render = (next: BadData): void => {
        data = next;
        badLayer.setSites(next.sites);
        tools.setSites(toXY(next.sites));
        panel.render(next);
      };
      render(merge(collection, null));
      // Status i ett andra steg: listan syns direkt, statusen fylls på (A4).
      render(merge(collection, await loadStatus()));
      if (selectedId) select(selectedId, true);
    } catch {
      showMapStatus(t('bad.status.unavailable'));
    }
  })();
}
