/**
 * Planär längd och vitlistan över projektioner där den är godkänd (NFK-12).
 *
 * Egen modul **utan beroenden** — precis som crs.ts. Delen är utbruten för att den som bara
 * behöver planär längd eller vitlistan ska slippa dra in proj4 (42 kB gzip) via measure.ts;
 * Origos bundle har redan en egen kopia.
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
