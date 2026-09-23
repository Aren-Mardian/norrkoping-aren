/**
 * Badplatslagret, skrivet mot ett *injicerat* OpenLayers (ADR-15).
 *
 * Sidan har en enda karta, men två motorer kan rita den: vår egen OpenLayers i normalläge och
 * Origos inbyggda kopia när verktygen är påslagna. Klasserna är API-identiska men kommer ur
 * olika bundlar, så implementationen tar emot dem som en `OlKit` i stället för att importera
 * dem. Då finns symbolerna, träffytorna och markeringslogiken på exakt ett ställe (UX-06, NFK-09).
 *
 * Koordinaterna kommer färdiga i EPSG:3006 — transformen görs en gång av anroparen, så den här
 * modulen behöver varken proj4 eller projektionsregistret.
 */
import type { StatusLevel } from '../../shared/bad/status.ts';
import type { Badplats } from './model.ts';

const GLYPH: Record<StatusLevel, string> = { ok: '✓', warn: '!', bad: '✕', unknown: '?' };

/* Minimal yta av OpenLayers som lagret behöver — uppfylld av både 'ol' och Origo.ol. */
export interface OlFeatureLike {
  setId(id: string): void;
  getId(): string | number | undefined;
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  getGeometry(): { getCoordinates(): number[] } | undefined;
}
export interface OlSourceLike {
  clear(): void;
  addFeatures(features: OlFeatureLike[]): void;
  getFeatureById(id: string): OlFeatureLike | null;
}
export interface OlLayerLike {
  changed(): void;
}
export interface OlMapLike {
  on(type: 'singleclick' | 'pointermove', listener: (e: { pixel: number[]; dragging?: boolean }) => void): void;
  forEachFeatureAtPixel(
    pixel: number[],
    callback: (f: OlFeatureLike) => OlFeatureLike,
    options: { layerFilter(l: unknown): boolean; hitTolerance: number },
  ): OlFeatureLike | undefined;
  getTargetElement(): HTMLElement;
  addLayer(layer: unknown): void;
  removeLayer(layer: unknown): void;
}

export interface OlKit {
  Feature: new (opts: { geometry: unknown }) => OlFeatureLike;
  Point: new (coords: number[]) => unknown;
  VectorLayer: new (opts: Record<string, unknown>) => OlLayerLike;
  VectorSource: new (opts?: Record<string, unknown>) => OlSourceLike;
  Style: new (opts: Record<string, unknown>) => unknown;
  Circle: new (opts: Record<string, unknown>) => unknown;
  Fill: new (opts: Record<string, unknown>) => unknown;
  Stroke: new (opts: Record<string, unknown>) => unknown;
  Text: new (opts: Record<string, unknown>) => unknown;
}

export interface BadLayerCore {
  layer: OlLayerLike;
  /** `sites` med färdiga EPSG:3006-koordinater. */
  setSites(sites: ReadonlyArray<{ site: Badplats; xy: number[] }>): void;
  setSelected(id: string | null): void;
  setHover(id: string | null): void;
  onSelect(cb: (id: string | null) => void): void;
  onHover(cb: (id: string | null) => void): void;
  getCoordinates(id: string): number[] | undefined;
  /** Tar bort lagret och dess lyssnare från kartan. */
  destroy(): void;
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function createBadLayerCore(ol: OlKit, map: OlMapLike): BadLayerCore {
  const source = new ol.VectorSource();
  let selectedId: string | null = null;
  let hoverId: string | null = null;
  const selectListeners: Array<(id: string | null) => void> = [];
  const hoverListeners: Array<(id: string | null) => void> = [];
  const styleCache = new Map<string, unknown[]>();

  function styleFor(feature: OlFeatureLike): unknown[] {
    const level = feature.get('level') as StatusLevel;
    const rank = feature.get('top3Rank') as number | undefined;
    const state = feature.getId() === selectedId ? 'sel' : feature.getId() === hoverId ? 'hov' : 'idle';
    const key = `${level}|${rank ?? ''}|${state}`;
    const cached = styleCache.get(key);
    if (cached) return cached;

    const fill = token(`--c-status-${level}`, '#888');
    const text = token(`--c-status-${level}-contrast`, '#fff');
    const halo = token('--c-surface', '#fff');
    const radius = state === 'sel' ? 15 : state === 'hov' ? 13 : 11;

    const styles: unknown[] = [
      new ol.Style({
        image: new ol.Circle({
          radius,
          fill: new ol.Fill({ color: fill }),
          stroke: new ol.Stroke({ color: halo, width: state === 'sel' ? 3 : 2 }),
        }),
        text: new ol.Text({
          text: GLYPH[level],
          font: `bold ${state === 'sel' ? 15 : 13}px system-ui, sans-serif`,
          fill: new ol.Fill({ color: text }),
        }),
        zIndex: state === 'sel' ? 3 : state === 'hov' ? 2 : 1,
      }),
    ];
    if (rank) {
      const gold = token('--c-top3', '#e9b949');
      styles.push(
        new ol.Style({
          image: new ol.Circle({ radius: radius + 4, fill: new ol.Fill({ color: 'rgba(0,0,0,0)' }), stroke: new ol.Stroke({ color: gold, width: 3 }) }),
          zIndex: 0,
        }),
        new ol.Style({
          image: new ol.Circle({
            radius: 8,
            fill: new ol.Fill({ color: gold }),
            stroke: new ol.Stroke({ color: halo, width: 1.5 }),
            displacement: [radius + 2, radius + 2],
          }),
          text: new ol.Text({
            text: String(rank),
            font: 'bold 11px system-ui, sans-serif',
            fill: new ol.Fill({ color: '#1d2126' }),
            offsetX: radius + 2,
            offsetY: -(radius + 2),
          }),
          zIndex: 4,
        }),
      );
    }
    styleCache.set(key, styles);
    return styles;
  }

  const layer = new ol.VectorLayer({
    source,
    style: (f: OlFeatureLike) => styleFor(f),
    zIndex: 20,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    // Symbolerna ska vara läsbara på mobil vid startzoom: ingen deklutter, fasta radier.
    name: 'badplatser',
    title: 'Badplatser',
    group: 'none',
  });
  map.addLayer(layer);

  // Klick → välj; klick utanför → avmarkera. hitTolerance ger ≥ 44 px träffyta (NFK-10).
  const onClick = (evt: { pixel: number[] }): void => {
    const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === layer, hitTolerance: 12 });
    const id = hit ? String(hit.getId()) : null;
    for (const cb of selectListeners) cb(id);
  };
  const onMove = (evt: { pixel: number[]; dragging?: boolean }): void => {
    if (evt.dragging) return;
    const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === layer, hitTolerance: 8 });
    const id = hit ? String(hit.getId()) : null;
    if (id === hoverId) return;
    map.getTargetElement().style.cursor = id ? 'pointer' : '';
    for (const cb of hoverListeners) cb(id);
  };
  map.on('singleclick', onClick);
  map.on('pointermove', onMove);

  return {
    layer,
    setSites(sites) {
      source.clear();
      source.addFeatures(
        sites.map(({ site, xy }) => {
          const f = new ol.Feature({ geometry: new ol.Point(xy) });
          f.setId(site.id);
          f.set('level', site.level);
          f.set('top3Rank', site.props.isTop3 ? site.props.top3Rank : undefined);
          f.set('name', site.props.fullName);
          return f;
        }),
      );
      styleCache.clear();
    },
    setSelected(id) {
      selectedId = id;
      layer.changed();
    },
    setHover(id) {
      hoverId = id;
      layer.changed();
    },
    onSelect(cb) {
      selectListeners.push(cb);
    },
    onHover(cb) {
      hoverListeners.push(cb);
    },
    getCoordinates(id) {
      return source.getFeatureById(id)?.getGeometry()?.getCoordinates();
    },
    destroy() {
      map.removeLayer(layer);
      selectListeners.length = 0;
      hoverListeners.length = 0;
    },
  };
}
