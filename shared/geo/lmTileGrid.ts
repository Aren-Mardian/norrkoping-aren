/**
 * Lantmäteriets tile-matris "3006" för visningstjänsterna (WMTS) i SWEREF 99 TM.
 *
 * Origo i övre vänstra hörnet, 256 px rutor, 16 nivåer med halverad upplösning
 * per nivå (4096 m/px … 0,125 m/px). Ren aritmetik utan OpenLayers-beroende så
 * att tile-proxyn kan räkna ut en rutas utbredning för bbox-spärren (NFK-18).
 *
 * Verifiera mot GetCapabilities i Geotorgets tekniska beskrivning (JK-07).
 */
import { EXTENT_3006 } from './projDefs.ts';
import type { Extent } from './kommun.ts';

export const LM_TILE_SIZE = 256;
export const LM_3006_EXTENT: Extent = EXTENT_3006;
export const LM_3006_ORIGIN = [EXTENT_3006[0], EXTENT_3006[3]] as const;
export const LM_3006_RESOLUTIONS: readonly number[] = Array.from({ length: 16 }, (_, z) => 4096 / 2 ** z);
export const LM_3006_MATRIX_IDS: readonly string[] = LM_3006_RESOLUTIONS.map((_, z) => String(z));

function resolutionAt(z: number): number {
  const res = LM_3006_RESOLUTIONS[z];
  if (res === undefined) throw new RangeError(`Zoomnivå ${z} finns inte i LM-matrisen (0–15)`);
  return res;
}

/** Utbredning i EPSG:3006 för ruta (z, x, y) i LM-matrisen. y räknas nedåt från origo. */
export function lmTileExtent(z: number, x: number, y: number): Extent {
  const size = resolutionAt(z) * LM_TILE_SIZE;
  const minX = LM_3006_ORIGIN[0] + x * size;
  const maxY = LM_3006_ORIGIN[1] - y * size;
  return [minX, maxY - size, minX + size, maxY];
}

/** Antal rutor per axel på en nivå (matrisen är kvadratisk: 3,62 rutor på nivå 0). */
export function lmMatrixSize(z: number): number {
  return Math.ceil((LM_3006_EXTENT[2] - LM_3006_EXTENT[0]) / (resolutionAt(z) * LM_TILE_SIZE));
}

// ── Web Mercator (bara för fallback-bakgrunden, aldrig för mätning — NFK-12) ──

const WM_HALF = 20_037_508.342789244;

/** Utbredning i EPSG:3857 för en standard-XYZ-ruta. */
export function webMercatorTileExtent(z: number, x: number, y: number): Extent {
  const size = (2 * WM_HALF) / 2 ** z;
  const minX = -WM_HALF + x * size;
  const maxY = WM_HALF - y * size;
  return [minX, maxY - size, minX + size, maxY];
}
