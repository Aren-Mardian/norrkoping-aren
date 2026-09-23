/**
 * Höjdverktyget på Origo-sidan (FK-25b): markhöjd i en punkt och höjdprofil längs en ritad
 * linje, ur Lantmäteriets *Markhöjd Direkt* (IK-08) via sajtens egen proxy.
 *
 *  - Ett klick  → en punkt med höjdetikett (ett GET-anrop, cachat ett dygn på kanten).
 *  - Flera klick → linje; vid dubbelklick samplas den med jämnt fördelade punkter och
 *    ett enda POST-anrop ger hela profilen. Lägsta/högsta punkt, total stigning och längd
 *    redovisas; längden mäts geodetiskt med samma kod som landningsvyn (NFK-12, TK-03).
 *
 * Verktyget använder Origos egen OpenLayers-instans (`Origo.ol`) — inga OL-importer här, så
 * Origo-sidans egen bundle växer med ~3 kB och landningsvyn påverkas inte alls (TK-05).
 */
import { planarLengthIn } from '../../shared/geo/planar.ts';
import { t } from '../i18n/index.ts';
import { hojdProfile } from '../lm/hojd.ts';

/** Antal punkter en profil samplas i — 200 är proxyns tak och räcker gott för en linje i kommunen. */
const MAX_SAMPLES = 120;
/** Minsta avstånd mellan samplingspunkter; tätare än så säger höjdmodellen inget nytt. */
const MIN_STEP_M = 10;

interface OlNamespace {
  geom: { LineString: new (coords: number[][]) => OlGeometry };
  interaction: { Draw: new (opts: Record<string, unknown>) => OlInteraction };
  layer: { Vector: new (opts: Record<string, unknown>) => OlLayer };
  source: { Vector: new (opts?: Record<string, unknown>) => OlVectorSource };
  style: {
    Style: new (opts: Record<string, unknown>) => unknown;
    Circle: new (opts: Record<string, unknown>) => unknown;
    Fill: new (opts: Record<string, unknown>) => unknown;
    Stroke: new (opts: Record<string, unknown>) => unknown;
    Text: new (opts: Record<string, unknown>) => unknown;
  };
  Feature: new (opts: Record<string, unknown>) => OlFeature;
}

interface OlGeometry {
  getCoordinates(): number[][];
  getLength(): number;
}
interface OlFeature {
  getGeometry(): OlGeometry | undefined;
  set(key: string, value: unknown): void;
}
interface OlVectorSource {
  addFeature(f: OlFeature): void;
  clear(): void;
}
interface OlLayer {
  setMap?(map: unknown): void;
}
interface OlInteraction {
  on(type: string, listener: (e: { feature: OlFeature }) => void): void;
  setActive(active: boolean): void;
}
interface OlMapLike {
  addLayer(layer: OlLayer): void;
  addInteraction(i: OlInteraction): void;
  removeInteraction(i: OlInteraction): void;
}

export interface HojdVerktyg {
  /** Slår på/av ritläget. */
  setActive(active: boolean): void;
  isActive(): boolean;
  clear(): void;
}

/** Jämnt fördelade punkter längs en linje i kartans projektion (EPSG:3006). */
export function samplePoints(coords: readonly number[][], maxSamples = MAX_SAMPLES, minStep = MIN_STEP_M): Array<[number, number]> {
  const segments: Array<{ from: number[]; to: number[]; length: number }> = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const from = coords[i - 1];
    const to = coords[i];
    if (!from || !to) continue;
    const length = Math.hypot((to[0] ?? 0) - (from[0] ?? 0), (to[1] ?? 0) - (from[1] ?? 0));
    if (length === 0) continue;
    segments.push({ from, to, length });
    total += length;
  }
  if (segments.length === 0) {
    const only = coords[0];
    return only ? [[only[0] ?? 0, only[1] ?? 0]] : [];
  }

  const count = Math.max(2, Math.min(maxSamples, Math.floor(total / minStep) + 1));
  const out: Array<[number, number]> = [];
  let segment = 0;
  let consumed = 0;
  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    while (segment < segments.length - 1 && consumed + (segments[segment]?.length ?? 0) < target) {
      consumed += segments[segment]?.length ?? 0;
      segment += 1;
    }
    const seg = segments[segment];
    if (!seg) break;
    const ratio = seg.length === 0 ? 0 : Math.min(1, Math.max(0, (target - consumed) / seg.length));
    out.push([
      (seg.from[0] ?? 0) + ((seg.to[0] ?? 0) - (seg.from[0] ?? 0)) * ratio,
      (seg.from[1] ?? 0) + ((seg.to[1] ?? 0) - (seg.from[1] ?? 0)) * ratio,
    ]);
  }
  return out;
}

/** Sammanfattar en profil: lägsta, högsta och total stigning (summan av alla uppförsbackar). */
export function summarize(heights: ReadonlyArray<number | null>): { min: number; max: number; gain: number } | null {
  const known = heights.filter((z): z is number => z !== null);
  if (known.length === 0) return null;
  let gain = 0;
  let previous: number | null = null;
  for (const z of heights) {
    if (z === null) continue;
    if (previous !== null && z > previous) gain += z - previous;
    previous = z;
  }
  return { min: Math.min(...known), max: Math.max(...known), gain };
}

function formatLength(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

export function createHojdVerktyg(ol: OlNamespace, map: OlMapLike, panel: HTMLElement): HojdVerktyg {
  const source = new ol.source.Vector();
  const style = (feature: OlFeature): unknown => {
    const label = String((feature as unknown as { get(k: string): unknown }).get('label') ?? '');
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: '#0b5d8a' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
      }),
      stroke: new ol.style.Stroke({ color: '#0b5d8a', width: 3 }),
      text: label
        ? new ol.style.Text({
            text: label,
            font: 'bold 12px system-ui, sans-serif',
            offsetY: -16,
            padding: [3, 5, 3, 5],
            fill: new ol.style.Fill({ color: '#1d2126' }),
            backgroundFill: new ol.style.Fill({ color: 'rgba(255,255,255,0.9)' }),
            backgroundStroke: new ol.style.Stroke({ color: '#0b5d8a', width: 1 }),
          })
        : undefined,
    });
  };
  // group: 'none' håller resultatlagret utanför teckenförklaringen — precis som Origo gör med
  // sitt eget mätlager. Utan namn/titel listar Origo det som "Titel saknas".
  map.addLayer(
    new ol.layer.Vector({ source, style, zIndex: 40, name: 'hojdresultat', title: t('origo.hojd.title'), group: 'none' }),
  );

  const draw = new ol.interaction.Draw({ source: new ol.source.Vector(), type: 'LineString' });
  draw.setActive(false);

  let active = false;
  let abort: AbortController | null = null;

  const status = document.createElement('p');
  status.className = 'hojd__status';
  status.setAttribute('role', 'status');
  status.textContent = t('origo.hojd.hint');
  panel.appendChild(status);

  function say(message: string): void {
    status.textContent = message;
  }

  async function measure(geometry: OlGeometry): Promise<void> {
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    const coords = geometry.getCoordinates();
    say(t('origo.hojd.loading'));

    // En enda klickpunkt (dubbelklick ger två identiska hörn) behandlas som punktmätning.
    const unique = coords.filter((c, i) => i === 0 || Math.hypot((c[0] ?? 0) - (coords[i - 1]?.[0] ?? 0), (c[1] ?? 0) - (coords[i - 1]?.[1] ?? 0)) > 0.5);
    const points = unique.length <= 1 ? samplePoints(unique.slice(0, 1)) : samplePoints(unique);
    const result = await hojdProfile(points, signal);
    if (signal.aborted) return;
    if (result.length === 0) {
      say(t('origo.hojd.failed'));
      return;
    }

    source.clear();
    if (unique.length <= 1) {
      const z = result[0]?.z ?? null;
      const point = new ol.Feature({ geometry: new ol.geom.LineString([points[0] ?? [0, 0]]) });
      point.set('label', z === null ? t('origo.hojd.missing') : t('origo.hojd.point').replace('{n}', z.toFixed(1)));
      source.addFeature(point);
      say(z === null ? t('origo.hojd.missing') : `${t('origo.hojd.point').replace('{n}', z.toFixed(1))} · ${t('origo.hojd.source')}`);
      return;
    }

    const line = new ol.Feature({ geometry: new ol.geom.LineString(unique) });
    source.addFeature(line);
    // Etikett i profilens ändpunkter så att man ser start- och sluthöjd direkt i kartan.
    for (const index of [0, result.length - 1]) {
      const point = result[index];
      if (!point || point.z === null) continue;
      const marker = new ol.Feature({ geometry: new ol.geom.LineString([[point.e, point.n]]) });
      marker.set('label', `${point.z.toFixed(1)} m`);
      source.addFeature(marker);
    }

    const stats = summarize(result.map((p) => p.z));
    // Linjen är redan i kartans projektion (SWEREF 99 TM) — planär mätning är godkänd där,
    // och planarLengthIn vägrar allt annat, så ingen kan råka mäta i Web Mercator (NFK-12).
    const length = planarLengthIn(unique.map((c) => [c[0] ?? 0, c[1] ?? 0] as [number, number]), 'EPSG:3006');
    say(
      stats === null
        ? t('origo.hojd.missing')
        : `${t('origo.hojd.profile')
            .replace('{points}', String(result.length))
            .replace('{min}', stats.min.toFixed(1))
            .replace('{max}', stats.max.toFixed(1))
            .replace('{gain}', stats.gain.toFixed(0))
            .replace('{length}', formatLength(length))} · ${t('origo.hojd.source')}`,
    );
  }

  draw.on('drawstart', () => {
    source.clear();
    say(t('origo.hojd.hint'));
  });
  draw.on('drawend', (event) => {
    const geometry = event.feature.getGeometry();
    if (geometry) void measure(geometry);
  });

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) map.addInteraction(draw);
      else map.removeInteraction(draw);
      draw.setActive(active);
      if (!active) {
        abort?.abort();
        source.clear();
      }
      say(t('origo.hojd.hint'));
    },
    isActive: () => active,
    clear() {
      abort?.abort();
      source.clear();
      say(t('origo.hojd.hint'));
    },
  };
}
