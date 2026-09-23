/**
 * Verktygsläget (Origo) i samma kartruta som landningsvyn (ADR-15).
 *
 * Origo kan inte överta en befintlig OpenLayers-karta — den skapar alltid sin egen. Sidan har
 * därför två kartmotorer men **en kartyta**: vår lätta karta visas direkt, och när användaren
 * trycker "Verktyg" hämtas Origo (~590 kB brotli) med `import()` och monteras i samma ruta,
 * med samma vy, samma badplatser och samma markering. Den som aldrig öppnar verktygen betalar
 * ingenting för dem (TK-05, NFK-02).
 *
 * Hela den här modulen — och Origos bundle — ligger utanför landningsvyns kritiska väg.
 */
import { BASE, IS_DEV, TOPO_PMTILES_URL } from '../config/site.ts';
import { t } from '../i18n/index.ts';
import type { Badplats } from '../bad/model.ts';
import { createBadLayerCore, type BadLayerCore, type OlKit, type OlMapLike } from '../bad/layerCore.ts';
import { createPmtilesTileLoader, type ImageTileLike } from '../map/pmtilesLoader.ts';
import { createHojdVerktyg, type HojdVerktyg } from './hojdverktyg.ts';
import { ORIGO_CSS, ORIGO_SCRIPT, TOPO_LAYER_NAME, buildOrigoConfig } from './origoConfig.ts';

export interface ToolsView {
  center: number[];
  zoom: number;
}

export interface Tools {
  /** Badplatser i Origos karta — samma symboler och träffytor som i vår egen (layerCore). */
  setSites(sites: ReadonlyArray<{ site: Badplats; xy: number[] }>): void;
  setSelected(id: string | null): void;
  setHover(id: string | null): void;
  onSelect(cb: (id: string | null) => void): void;
  onHover(cb: (id: string | null) => void): void;
  zoomTo(xy: number[], zoom: number): void;
  getView(): ToolsView;
  /**
   * Mät upp kartytan och rita om. Måste anropas när verktygsläget blir synligt: elementet
   * delar yta med vår egen karta, och Origo hinner mäta upp den innan den är i full storlek.
   */
  refresh(): void;
  /** Höjdverktyget (IK-08) — knappen i kartans verktygsrad styr det. */
  hojd: HojdVerktyg;
}

/** Origos egen CSS. Laddas tillsammans med bundlen — aldrig på ett besök som inte öppnar verktygen. */
function loadStylesheet(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    // Saknad stil ska inte hindra kartan från att fungera — därför resolve även vid fel.
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(link);
  });
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

/**
 * Kopplar PMTiles-läsaren till Origos bakgrundslager — samma fil som vår egen karta läser.
 * Returnerar källan, som behövs för att tvinga fram en omritning när kartytan byter storlek.
 */
function attachBasemap(viewer: OrigoViewer, onFailure: () => void): OrigoTileSource | null {
  const layer = viewer.getLayer(TOPO_LAYER_NAME);
  if (!layer) {
    onFailure();
    return null;
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
  loader.ready.then((info) => source.setAttributions(info.attribution)).catch(onFailure);
  return source;
}

/**
 * Origo lägger sina ikonspritar som `<div><svg style="display:none">` direkt i `<body>`, och
 * litar på inline-stilen. Blockeras style-attribut av en strikt CSP blir divarna synliga tomma
 * block som trycker ner kartan (sett live). Märk dem i stället med en klass som CSS:en döljer —
 * ett attribut kan ingen CSP ta bort. Spritarna måste ligga kvar i dokumentet: ikonerna
 * refererar dem med <use>.
 */
function markSprites(): void {
  for (const svg of document.querySelectorAll('body > div > svg')) {
    const holder = svg.parentElement;
    if (holder && holder.children.length === 1 && svg.querySelector(':scope > symbol')) {
      holder.classList.add('origo-sprite');
    }
  }
}

function hideSpriteContainers(): void {
  markSprites();
  // Origo hämtar sprite-filerna med fetch och lägger in dem efterhand, så de finns sällan
  // när `load` går. En kortlivad observatör fångar dem när de dyker upp och kopplas sedan ned.
  const observer = new MutationObserver(markSprites);
  observer.observe(document.body, { childList: true });
  window.setTimeout(() => observer.disconnect(), 15_000);
}

/**
 * Origo kräver som standard Ctrl för att zooma med rullhjulet. På den här sidan behövs det
 * inte: kartan fyller sin egen yta och dokumentet bakom scrollar aldrig (ADR-13), så det finns
 * inget att skrolla förbi. Kravet tas bort genom att MouseWheelZoom-interaktionens villkor
 * byts mot ett som alltid gäller — samma beteende som vår egen karta (ADR-15).
 *
 * Interaktionen känns igen på sina egna fält (`useAnchor_` + `deltaPerZoom_`) i stället för på
 * klassnamnet, som är minifierat i den vendorerade bundlen.
 */
function allowPlainWheelZoom(viewer: OrigoViewer): void {
  const map = viewer.getMap() as unknown as { getInteractions(): { getArray(): unknown[] } };
  for (const interaction of map.getInteractions().getArray()) {
    const candidate = interaction as { useAnchor_?: unknown; deltaPerZoom_?: unknown; condition_?: unknown };
    if (candidate.useAnchor_ !== undefined && candidate.deltaPerZoom_ !== undefined) {
      candidate.condition_ = () => true;
      return;
    }
  }
}

export interface LoadToolsOptions {
  /** Elementet Origo monteras i (samma kartyta som vår egen karta ligger i). */
  mount: HTMLElement;
  /** Vy att öppna i — hämtas från vår karta så att inget hoppar. */
  view: ToolsView;
  /** Värd för höjdverktygets statusrad. */
  statusHost: HTMLElement;
  onBasemapFailure(): void;
}

export async function loadTools({ mount, view, statusHost, onBasemapFailure }: LoadToolsOptions): Promise<Tools> {
  await Promise.all([loadStylesheet(ORIGO_CSS), loadScript(ORIGO_SCRIPT)]);
  const Origo = window.Origo;
  if (!Origo) throw new Error('Origo kunde inte initieras');

  const viewer = await new Promise<OrigoViewer>((resolve) => {
    // Origo lägger alltid till <base href={baseUrl}>; CSP:n tillåter base-uri 'self' (ADR-12).
    const origo = Origo(buildOrigoConfig(mount.id, view), { baseUrl: BASE });
    origo.on('load', (v) => resolve(v));
    if (IS_DEV) (window as unknown as { __origo?: unknown }).__origo = origo;
  });

  const topoSource = attachBasemap(viewer, onBasemapFailure);
  allowPlainWheelZoom(viewer);
  hideSpriteContainers();

  const ol = Origo.ol;
  const map = viewer.getMap() as unknown as OlMapLike;
  let bad: BadLayerCore | null = null;
  if (ol) {
    bad = createBadLayerCore(
      {
        Feature: ol.Feature,
        Point: (ol.geom as { Point: unknown }).Point,
        VectorLayer: (ol.layer as { Vector: unknown }).Vector,
        VectorSource: (ol.source as { Vector: unknown }).Vector,
        Style: (ol.style as { Style: unknown }).Style,
        Circle: (ol.style as { Circle: unknown }).Circle,
        Fill: (ol.style as { Fill: unknown }).Fill,
        Stroke: (ol.style as { Stroke: unknown }).Stroke,
        Text: (ol.style as { Text: unknown }).Text,
      } as unknown as OlKit,
      map,
    );
  }

  const olMap = viewer.getMap() as unknown as { getView(): OrigoView; updateSize(): void; render(): void };
  const olView = olMap.getView();
  const hojd = createHojdVerktyg(ol as never, map as never, statusHost);

  const noop = (): void => {};
  return {
    setSites: bad ? (sites) => bad.setSites(sites) : noop,
    setSelected: bad ? (id) => bad.setSelected(id) : noop,
    setHover: bad ? (id) => bad.setHover(id) : noop,
    onSelect: bad ? (cb) => bad.onSelect(cb) : noop,
    onHover: bad ? (cb) => bad.onHover(cb) : noop,
    zoomTo(xy, zoom) {
      olView.animate({ center: xy, zoom, duration: 400 });
    },
    getView: () => ({ center: olView.getCenter() ?? view.center, zoom: olView.getZoom() ?? view.zoom }),
    refresh() {
      olMap.updateSize();
      // Rutlagret jämför revision och ritar inte om en ram det tror är oförändrad. När kartytan
      // byter storlek (vi växlar motor) ligger redan hämtade rutor kvar otecknade tills källans
      // revision ändras — utan det här blev bakgrunden tom (verifierat 2026-09-23).
      topoSource?.changed();
      olMap.render();
    },
    hojd,
  };
}

interface OrigoView {
  animate(options: Record<string, unknown>): void;
  getCenter(): number[] | undefined;
  getZoom(): number | undefined;
}
