/**
 * Ren, testbar logik för höjdproxyn (IK-08): parametertolkning, spärrar och normalisering
 * av Lantmäteriets *Markhöjd Direkt* (CC BY 4.0). Ingen I/O här — handlern gör anropet.
 *
 * Tjänsten tar SWEREF 99 TM och svarar med GeoJSON där Z är markhöjd i RH 2000:
 *   GET  /hojd?srid=3006&e=<öst>&n=<norr>        → Feature(Point [e, n, z])
 *   POST /hojd?srid=3006  body {MultiPoint}      → Feature(MultiPoint [[e, n, z], …])
 * Punkter utan data får `nodatavalue` (-9999) som Z — de normaliseras till null.
 */
import { PAN_LIMIT_3006 } from '../../shared/geo/kommun.ts';

/** Lantmäteriets markör för "ingen höjddata här". */
export const NODATA = -9999;

/** Största antal punkter i ett batchanrop — håller svarstid och uppströmslast nere (NFK-18). */
export const MAX_POINTS = 200;

export interface HojdPoint {
  /** SWEREF 99 TM. */
  e: number;
  n: number;
  /** Markhöjd i meter över havet (RH 2000), eller null där data saknas. */
  z: number | null;
}

export type ParsedPoints = { ok: true; points: Array<[number, number]> } | { ok: false; reason: string };

function insideKommun(e: number, n: number): boolean {
  const [minE, minN, maxE, maxN] = PAN_LIMIT_3006;
  return e >= minE && e <= maxE && n >= minN && n <= maxN;
}

function coordinate(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** En punkt ur query-strängen: ?e=&n= (SWEREF 99 TM). */
export function parseQueryPoint(params: URLSearchParams): ParsedPoints {
  const e = coordinate(params.get('e'));
  const n = coordinate(params.get('n'));
  if (e === null || n === null) return { ok: false, reason: 'e och n krävs (SWEREF 99 TM).' };
  if (!insideKommun(e, n)) return { ok: false, reason: 'Punkten ligger utanför Norrköpings kommun.' };
  return { ok: true, points: [[e, n]] };
}

/**
 * Punkter ur en POST-kropp: `{ points: [[e, n], …] }`. Alla måste ligga inom spärren —
 * proxyn får inte bli ett fritt höjdorakel för hela Sverige (NFK-18).
 */
export function parseBody(body: unknown): ParsedPoints {
  const raw = (body as { points?: unknown })?.points;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'points krävs: [[e, n], …].' };
  if (raw.length > MAX_POINTS) return { ok: false, reason: `Högst ${MAX_POINTS} punkter per anrop.` };
  const points: Array<[number, number]> = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) return { ok: false, reason: 'Varje punkt ska vara [e, n].' };
    const e = coordinate(item[0]);
    const n = coordinate(item[1]);
    if (e === null || n === null) return { ok: false, reason: 'Varje punkt ska vara [e, n] med tal.' };
    if (!insideKommun(e, n)) return { ok: false, reason: 'Minst en punkt ligger utanför Norrköpings kommun.' };
    points.push([e, n]);
  }
  return { ok: true, points };
}

interface MarkhojdResponse {
  geometry?: { type?: string; coordinates?: unknown };
}

/** Plockar ut [e, n, z] ur svaret oavsett om det är Point eller MultiPoint, och nollställer nodata. */
export function normalizeHojd(raw: MarkhojdResponse): HojdPoint[] {
  const geom = raw?.geometry;
  const coords = geom?.coordinates;
  const triples: unknown[] = geom?.type === 'MultiPoint' ? (Array.isArray(coords) ? coords : []) : [coords];
  const out: HojdPoint[] = [];
  for (const t of triples) {
    if (!Array.isArray(t) || t.length < 2) continue;
    const e = coordinate(t[0]);
    const n = coordinate(t[1]);
    const zRaw = t.length > 2 ? coordinate(t[2]) : null;
    if (e === null || n === null) continue;
    out.push({ e, n, z: zRaw === null || zRaw <= NODATA ? null : Math.round(zRaw * 100) / 100 });
  }
  return out;
}

/** Uppströms-URL för ett punktanrop (GET) respektive batch (POST använder samma bas). */
export function buildUpstreamUrl(base: string, srid = 3006): string {
  return `${base.replace(/\/$/, '')}/hojd?srid=${srid}`;
}

/** Kroppen som Markhöjd Direkt vill ha vid batch: en GeoJSON MultiPoint. */
export function buildUpstreamBody(points: ReadonlyArray<readonly [number, number]>): string {
  return JSON.stringify({ type: 'MultiPoint', coordinates: points.map(([e, n]) => [e, n]) });
}
