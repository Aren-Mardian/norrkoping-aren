/**
 * Norrköpings kommun — identitet och utbredning.
 *
 * Bounding box enligt kravspec Bilaga B.3. Den är ungefärlig och ska verifieras
 * mot faktisk kommungränsgeometri innan den låser panorering (FK-04) och
 * datavalidering (DK-01). SWEREF 99 TM- och Web Mercator-hörnen är beräknade
 * med PROJ (pyproj 3.6) från WGS 84-hörnen.
 */

/** Kommunkod enligt SCB. Nyckel mot HaV:s och SCB:s data (Bilaga B.3). */
export const KOMMUN_KOD = '0581';

/** [minLon, minLat, maxLon, maxLat] i EPSG:4326. Även gräns för DK-02-validering. */
export const KOMMUN_BBOX_4326 = [15.55, 58.28, 17.05, 58.92] as const;

/** [minE, minN, maxE, maxN] i EPSG:3006 (SWEREF 99 TM). */
export const KOMMUN_BBOX_3006 = [532256, 6460016, 618039, 6532953] as const;

/** [minX, minY, maxX, maxY] i EPSG:3857. Används bara för fallback-lagrets bbox-spärr. */
export const KOMMUN_BBOX_3857 = [1731018, 8026368, 1897998, 8163116] as const;

/** Panoreringsbuffert runt kommunen (FK-04): 25 km. */
export const PAN_BUFFER_M = 25_000;

/** Referenspunkt Norrköping centrum (Bilaga B.2), [lon, lat]. */
export const CENTRUM_4326 = [16.1859, 58.58734] as const;

export type Extent = readonly [number, number, number, number];

export function bufferExtent(extent: Extent, meters: number): Extent {
  return [extent[0] - meters, extent[1] - meters, extent[2] + meters, extent[3] + meters];
}

export function extentsIntersect(a: Extent, b: Extent): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Buffrad kommun-bbox i 3006 — gräns för panorering och för tile-proxyn (NFK-18). */
export const PAN_LIMIT_3006: Extent = bufferExtent(KOMMUN_BBOX_3006, PAN_BUFFER_M);

/** Web Mercator har skalfaktor ≈ 1,92 här, så 25 km på marken ≈ 48 km i kartenheter. */
export const PAN_LIMIT_3857: Extent = bufferExtent(KOMMUN_BBOX_3857, PAN_BUFFER_M * 1.92);
