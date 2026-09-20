/**
 * Badplatslagret på landningsvyn (FK-15–FK-17). Symboler kodar status med färg OCH form/tecken
 * (UX-06): ✓ tjänligt, ! anmärkning/alger, ✕ avrådan/otjänligt, ? okänt. Topp 3 får ring och
 * rangsiffra. Träffyta ≥ 44 px genom hitTolerance (NFK-10). Färger från designtokens (UX-05).
 */
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import { Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import type { StatusLevel } from '../../shared/bad/status.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import type { Badplats } from './model.ts';

const GLYPH: Record<StatusLevel, string> = { ok: '✓', warn: '!', bad: '✕', unknown: '?' };

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export interface BadLayer {
  layer: VectorLayer<VectorSource<Feature<Point>>>;
  setSites(sites: readonly Badplats[]): void;
  setSelected(id: string | null): void;
  setHover(id: string | null): void;
  /** Klick på symbol. */
  onSelect(cb: (id: string | null) => void): void;
  onHover(cb: (id: string | null) => void): void;
  getFeature(id: string): Feature<Point> | undefined;
}

export function createBadLayer(map: OlMap): BadLayer {
  const source = new VectorSource<Feature<Point>>();
  let selectedId: string | null = null;
  let hoverId: string | null = null;
  const selectListeners: Array<(id: string | null) => void> = [];
  const hoverListeners: Array<(id: string | null) => void> = [];
  const styleCache = new Map<string, Style[]>();

  function colors(level: StatusLevel): { fill: string; text: string } {
    return {
      fill: token(`--c-status-${level}`, '#888'),
      text: token(`--c-status-${level}-contrast`, '#fff'),
    };
  }

  function styleFor(feature: Feature<Point>): Style[] {
    const level = feature.get('level') as StatusLevel;
    const rank = feature.get('top3Rank') as number | undefined;
    const state = feature.getId() === selectedId ? 'sel' : feature.getId() === hoverId ? 'hov' : 'idle';
    const key = `${level}|${rank ?? ''}|${state}`;
    const cached = styleCache.get(key);
    if (cached) return cached;

    const c = colors(level);
    const radius = state === 'sel' ? 15 : state === 'hov' ? 13 : 11;
    const halo = token('--c-surface', '#fff');
    const styles: Style[] = [
      new Style({
        image: new Circle({
          radius,
          fill: new Fill({ color: c.fill }),
          stroke: new Stroke({ color: halo, width: state === 'sel' ? 3 : 2 }),
        }),
        text: new Text({
          text: GLYPH[level],
          font: `bold ${state === 'sel' ? 15 : 13}px system-ui, sans-serif`,
          fill: new Fill({ color: c.text }),
        }),
        zIndex: state === 'sel' ? 3 : state === 'hov' ? 2 : 1,
      }),
    ];
    if (rank) {
      const gold = token('--c-top3', '#e9b949');
      styles.push(
        new Style({
          image: new Circle({ radius: radius + 4, fill: new Fill({ color: 'rgba(0,0,0,0)' }), stroke: new Stroke({ color: gold, width: 3 }) }),
          zIndex: 0,
        }),
        new Style({
          image: new Circle({ radius: 8, fill: new Fill({ color: gold }), stroke: new Stroke({ color: halo, width: 1.5 }), displacement: [radius + 2, radius + 2] }),
          text: new Text({ text: String(rank), font: 'bold 11px system-ui, sans-serif', fill: new Fill({ color: '#1d2126' }), offsetX: radius + 2, offsetY: -(radius + 2) }),
          zIndex: 4,
        }),
      );
    }
    styleCache.set(key, styles);
    return styles;
  }

  const layer = new VectorLayer({
    source,
    style: (f) => styleFor(f as Feature<Point>),
    zIndex: 20,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    // Symbolerna ska vara läsbara på mobil vid startzoom (FK-08-mönstret): ingen deklutter, fasta radier.
  });

  // Klick → välj; klick utanför → avmarkera. hitTolerance ger ≥ 44 px träffyta (NFK-10).
  map.on('singleclick', (evt) => {
    const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === layer, hitTolerance: 12 });
    const id = hit ? String(hit.getId()) : null;
    for (const cb of selectListeners) cb(id);
  });
  map.on('pointermove', (evt) => {
    if (evt.dragging) return;
    const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === layer, hitTolerance: 8 });
    const id = hit ? String(hit.getId()) : null;
    if (id === hoverId) return;
    map.getTargetElement().style.cursor = id ? 'pointer' : '';
    for (const cb of hoverListeners) cb(id);
  });

  return {
    layer,
    setSites(sites) {
      source.clear();
      source.addFeatures(
        sites.map((s) => {
          const f = new Feature<Point>({ geometry: new Point(fromLonLat(s.lonLat, EPSG_3006)) });
          f.setId(s.id);
          f.set('level', s.level);
          f.set('top3Rank', s.props.isTop3 ? s.props.top3Rank : undefined);
          f.set('name', s.props.fullName);
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
    getFeature: (id) => source.getFeatureById(id) ?? undefined,
  };
}
