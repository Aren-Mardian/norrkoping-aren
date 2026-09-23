/**
 * Referenssystemens koder, proj4-strängar och utbredning (kravspec Bilaga B.5) — ren data
 * utan beroende på proj4/OpenLayers, så att den kan importeras av lättviktig kod utan att
 * dra in biblioteken. Registrering och transformationer finns i projDefs.ts.
 *
 * **Sajten visar bara SWEREF 99 TM** (ADR-18). WGS 84 finns kvar eftersom inkommande data
 * har det formatet — GeoJSON enligt RFC 7946 och SMHI:s punktprognos — men det visas aldrig
 * för besökaren. Web Mercator finns med enbart för att kunna avvisas i mätkoden (NFK-12).
 */

export const EPSG_3006 = 'EPSG:3006';
/** Bara ett dataformat, aldrig något besökaren ser. */
export const EPSG_4326 = 'EPSG:4326';
/** Finns bara för att mätning i det ska kunna vägras (NFK-12). */
export const EPSG_3857 = 'EPSG:3857';

/** SWEREF 99 TM — nationell standard, och sajtens enda referenssystem. */
export const DEF_3006 =
  '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

/** Giltigt område för SWEREF 99 TM-visning, samma som Lantmäteriets tile-matris. */
export const EXTENT_3006 = [-1_200_000, 4_700_000, 2_600_000, 8_500_000] as const;
