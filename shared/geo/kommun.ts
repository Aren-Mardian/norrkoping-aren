/**
 * Norrköpings kommun — identitet och utbredning.
 *
 * Utbredningen är beräknad 2026-09-19 från kommungränsen i data/derived/kommungrans.geojson
 * (OpenStreetMap-relation 935447, ODbL; ersätts av Lantmäteriets polygon när STAC-åtkomst finns)
 * med PROJ via pyproj. Kravspecens Bilaga B.3 angav en uppskattad bbox som var ~12 km för hög
 * N–S och saknade havsområdet öster om skärgården — den är nu ersatt.
 */

/** Kommunkod enligt SCB. Nyckel mot HaV:s och SCB:s data (Bilaga B.3). */
export const KOMMUN_KOD = '0581';

/**
 * Hela kommunens bbox inkl. havsområde, [minLon, minLat, maxLon, maxLat] i EPSG:4326.
 * Gräns för datavalidering (DK-01, DK-02): allt kuraterat innehåll ska ligga här inom.
 */
export const KOMMUN_BBOX_4326 = [15.6175, 58.399, 17.5693, 58.8539] as const;

/** Samma bbox i EPSG:3006 (SWEREF 99 TM), [minE, minN, maxE, maxN]. Bas för proxyns bbox-spärr. */
export const KOMMUN_BBOX_3006 = [535844, 6475456, 650152, 6524384] as const;

/**
 * Startvyns utbredning (FK-03): land och skärgård, utan det öppna havet öster om Arkösund.
 * Östgränsen 620 000 är vald så att Arkösund/Sköldvik/Badholmarna ryms med marginal.
 */
export const KOMMUN_VIEW_BBOX_3006 = [535844, 6475456, 620000, 6524384] as const;

/** [minX, minY, maxX, maxY] i EPSG:3857. Används bara för fallback-lagrets bbox-spärr. */
export const KOMMUN_BBOX_3857 = [1738532, 8051606, 1955806, 8148876] as const;

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
