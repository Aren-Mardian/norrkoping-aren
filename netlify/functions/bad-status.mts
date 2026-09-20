/**
 * IK-02 — Badvattenstatus. GET /projekt/norrkoping/api/bad/status
 *
 *  - Hämtar samtliga badplatser i Norrköpings kommun från HaV (kommunkod 0581) och normaliserar
 *    till statusschemat i kravspec §6.3 (netlify/lib/hav.ts).
 *  - Returnerar alltid `fetchedAt` och `stale`.
 *  - Cache: s-maxage=3600, stale-while-revalidate=86400 (NFK-04) — HaV anropas högst en gång i timmen.
 *  - Vid uppströmsfel: senast kända svar med `stale: true` och HTTP 200; 503 om ingen cache finns.
 *  - Svar ≤ 30 kB gzip (19 badplatser ≈ 8 kB okomprimerat).
 *
 * HaV:s API svarar intermittent 500 (observerat 2026-09-20) — därför omförsök per badplats och
 * ett i-minnet-minne av senaste lyckade svar per funktionsinstans.
 */
import type { Config, Context } from '@netlify/functions';
import { apiError } from '../../shared/api/errors.ts';
import type { BadStatus, BadStatusResponse } from '../../shared/bad/status.ts';
import { type HavDetail, normalizeDetail } from '../lib/hav.ts';
import { fetchJson, mapLimit } from '../lib/upstream.ts';

const HAV = 'https://badplatsen.havochvatten.se/badplatsen/api';
const NUTS_PREFIX = 'SE0230581';
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400';
const CDN_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400, durable';

interface FeatureList {
  features: Array<{ properties: { NUTSKOD?: string; NAMN?: string } }>;
}

let lastGood: BadStatusResponse | null = null;

async function fetchAll(): Promise<BadStatusResponse> {
  const list = await fetchJson<FeatureList>(`${HAV}/feature`, { timeoutMs: 8_000, retries: 2 });
  const ids = list.features
    .map((f) => f.properties.NUTSKOD ?? '')
    .filter((id) => id.startsWith(NUTS_PREFIX))
    .sort();

  const previous = new Map((lastGood?.sites ?? []).map((s) => [s.havId, s]));
  const failed: string[] = [];
  const sites = await mapLimit(ids, 4, async (id) => {
    try {
      return normalizeDetail(await fetchJson<HavDetail>(`${HAV}/detail/${id}`, { timeoutMs: 8_000, retries: 2 }));
    } catch {
      failed.push(id);
      return previous.get(id) ?? null;
    }
  });

  return {
    fetchedAt: new Date().toISOString(),
    stale: failed.length > 0,
    source: 'Havs- och vattenmyndigheten, Badplatsen API',
    sites: sites.filter((s): s is BadStatus => s !== null),
    failed,
  };
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return apiError('BAD_REQUEST', 'Endast GET stöds.');

  let body: BadStatusResponse;
  try {
    body = await fetchAll();
    if (body.sites.length === 0) throw new Error('tomt svar');
    if (!body.stale) lastGood = body;
  } catch (err) {
    console.warn(JSON.stringify({ event: 'bad-status.upstream_error', message: (err as Error).message }));
    if (!lastGood) return apiError('UPSTREAM_UNAVAILABLE', 'Badvattenstatus kan inte hämtas just nu.', 300);
    body = { ...lastGood, stale: true };
  }

  return new Response(req.method === 'HEAD' ? null : JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': body.stale ? 'public, max-age=60, s-maxage=300' : CACHE_CONTROL,
      'Netlify-CDN-Cache-Control': body.stale ? 'public, s-maxage=300' : CDN_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const config: Config = {
  path: '/projekt/norrkoping/api/bad/status',
};
