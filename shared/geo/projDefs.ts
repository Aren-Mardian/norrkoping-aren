/**
 * proj4-definitioner för referenssystemen i kravspec Bilaga B.5.
 *
 * Definitionerna hålls här — utan beroende på OpenLayers — så att samma källa
 * används av klienten, edge-funktionerna och testerna (NFK-13, TK-02).
 * De ska verifieras mot Lantmäteriets officiella parametrar före produktion.
 * Dokumentation: docs/referenssystem.md
 */
import proj4 from 'proj4';

export const EPSG_3006 = 'EPSG:3006';
export const EPSG_3010 = 'EPSG:3010';
export const EPSG_4326 = 'EPSG:4326';
export const EPSG_3857 = 'EPSG:3857';

/** SWEREF 99 TM — nationell standard, kartvisning och mätning. */
export const DEF_3006 =
  '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

/** SWEREF 99 16 30 — Norrköpings kommunala system. */
export const DEF_3010 =
  '+proj=tmerc +lat_0=0 +lon_0=16.5 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

/** Giltigt område för SWEREF 99 TM-visning, samma som Lantmäteriets tile-matris. */
export const EXTENT_3006 = [-1_200_000, 4_700_000, 2_600_000, 8_500_000] as const;

let registered = false;

/** Registrerar 3006/3010 i proj4. Idempotent. 4326 och 3857 finns inbyggda. */
export function registerProjDefs(): typeof proj4 {
  if (!registered) {
    proj4.defs(EPSG_3006, DEF_3006);
    proj4.defs(EPSG_3010, DEF_3010);
    registered = true;
  }
  return proj4;
}

export type LonLat = readonly [number, number];
export type XY = readonly [number, number];

function transform(from: string, to: string, c: XY): XY {
  const out = registerProjDefs()(from, to, [c[0], c[1]]);
  return [out[0] as number, out[1] as number];
}

export function toSweref99TM(lonLat: LonLat): XY {
  return transform(EPSG_4326, EPSG_3006, lonLat);
}

export function toSweref991630(lonLat: LonLat): XY {
  return transform(EPSG_4326, EPSG_3010, lonLat);
}

export function toLonLat(xy: XY, from: string): LonLat {
  return transform(from, EPSG_4326, xy);
}

export function transformXY(xy: XY, from: string, to: string): XY {
  return transform(from, to, xy);
}
