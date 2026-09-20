/**
 * Referenssystemens koder, proj4-strängar och utbredning (kravspec Bilaga B.5) — ren data
 * utan beroende på proj4/OpenLayers, så att den kan importeras av lättviktiga sidor
 * (t.ex. verktygsläget, som använder Origos egna proj4) utan att dra in biblioteken.
 * Registrering och transformationer finns i projDefs.ts.
 */

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
