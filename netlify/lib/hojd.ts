/**
 * Ren, testbar logik för höjdproxyn (IK-08): parametertolkning, spärrar och normalisering
 * av Lantmäteriets *Markhöjd Direkt* (CC BY 4.0). Ingen I/O här — handlern gör anropet.
 *
 * Tjänsten tar SWEREF 99 TM och svarar med GeoJSON där Z är markhöjd i RH 2000:
 *   GET /hojd?srid=3006&e=<öst>&n=<norr> → Feature(Point [e, n, z])
 * Punkter utan data får `nodatavalue` (-9999) som Z — de normaliseras till null.
 * Batchläget (POST MultiPoint) togs bort med höjdprofilen (ADR-16); tjänsten stöder det
 * fortfarande om det behövs igen.
 */
import { pointInKommun } from '../../shared/geo/kommunPolygon.ts';

/** Lantmäteriets markör för "ingen höjddata här". */
export const NODATA = -9999;

export interface HojdPoint {
  /** SWEREF 99 TM. */
  e: number;
  n: number;
  /** Markhöjd i meter över havet (RH 2000), eller null där data saknas. */
  z: number | null;
}

export type ParsedPoints = { ok: true; points: Array<[number, number]> } | { ok: false; reason: string };

/**
 * Spärren följer kommunens faktiska gräns, inte dess bbox (ADR-16). Bbox:en är 114 × 49 km och
 * rymmer stora delar av grannkommunerna — om dem ska den här tjänsten inte svara.
 */
const insideKommun = pointInKommun;

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

/** Uppströms-URL för ett punktanrop. */
export function buildUpstreamUrl(base: string, srid = 3006): string {
  return `${base.replace(/\/$/, '')}/hojd?srid=${srid}`;
}

