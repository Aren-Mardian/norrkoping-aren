/**
 * Markhöjd (IK-08) — klientsidan av /api/hojd. Lantmäteriets *Markhöjd Direkt* via edge-proxyn;
 * appkontot finns bara på servern. Höjden är markhöjd i meter över havet (RH 2000).
 *
 * Liten med flit: den här modulen ligger i landningsvyns kritiska väg via sökpanelen och
 * i Origos höjdverktyg — ingen OpenLayers-import här.
 */
import { HOJD_URL } from '../config/site.ts';
import { fetchJson } from '../net/fetchJson.ts';

export interface HojdPoint {
  e: number;
  n: number;
  /** Meter över havet (RH 2000), eller null där Lantmäteriet saknar data. */
  z: number | null;
}

interface HojdResponse {
  points: HojdPoint[];
  heightSystem: string;
  source: string;
}

/** En punkt (EPSG:3006) → höjd, eller null om tjänsten inte svarar. */
export async function hojdAt(e: number, n: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetchJson<HojdResponse>(`${HOJD_URL}?e=${e.toFixed(1)}&n=${n.toFixed(1)}`, { retries: 1, signal });
    return res.points[0]?.z ?? null;
  } catch {
    return null;
  }
}

/**
 * Flera punkter i ett anrop (höjdprofil). Returnerar tom lista vid fel — anroparen
 * visar då ingen profil i stället för ett felmeddelande mitt i kartan (NFK-25).
 */
export async function hojdProfile(points: ReadonlyArray<readonly [number, number]>, signal?: AbortSignal): Promise<HojdPoint[]> {
  if (points.length === 0) return [];
  try {
    const res = await fetchJson<HojdResponse>(HOJD_URL, {
      method: 'POST',
      body: JSON.stringify({ points: points.map(([e, n]) => [Number(e.toFixed(1)), Number(n.toFixed(1))]) }),
      retries: 1,
      signal,
    });
    return res.points ?? [];
  } catch {
    return [];
  }
}
