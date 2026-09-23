/**
 * Planär längd och vitlistan över projektioner där den är godkänd (NFK-12).
 *
 * Egen modul **utan beroenden** — precis som crs.ts. Origo-sidans höjdverktyg behöver bara
 * de här två sakerna, och skulle det importeras ur measure.ts följde proj4 med (42 kB gzip)
 * trots att Origo redan har sin egen kopia inbyggd.
 */
import { EPSG_3006, EPSG_3010 } from './crs.ts';

export type XY = readonly [number, number];

/** Projektioner där planär längd/area är godkänd. Web Mercator finns medvetet inte med. */
export const MEASURABLE_PROJECTIONS: ReadonlySet<string> = new Set([EPSG_3006, EPSG_3010]);

export class ProjectionNotMeasurableError extends Error {
  constructor(public readonly projection: string) {
    super(
      `Mätning i ${projection} är inte tillåten (NFK-12). Använd ${EPSG_3006}/${EPSG_3010} eller geodetisk beräkning.`,
    );
    this.name = 'ProjectionNotMeasurableError';
  }
}

/** Planär längd av en bruten linje i godtyckliga projicerade enheter. Ingen kontroll — se measureLength. */
export function planarLength(coords: readonly XY[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    if (!a || !b) continue;
    sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return sum;
}

/**
 * Planär längd i ett system där det är tillåtet. Kastar för 3857 och andra icke-godkända
 * system — anroparen ska då välja geodetisk beräkning (measure.ts).
 */
export function planarLengthIn(coords: readonly XY[], projection: string): number {
  if (!MEASURABLE_PROJECTIONS.has(projection)) throw new ProjectionNotMeasurableError(projection);
  return planarLength(coords);
}
