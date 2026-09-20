/**
 * IK-03 — Väder. GET /projekt/norrkoping/api/vader?lat=&lon=
 *
 *  - SMHI:s öppna punktprognos (snow1g v1; ingen nyckel). Attribution: "Källa: SMHI".
 *  - Koordinater avrundas till 2 decimaler (≈ 1 km) innan vidaresändning — cachevänligt och
 *    integritetsvänligt; bara koordinater inom kommunens bbox accepteras.
 *  - s-maxage=1800 (30 min). Origin-lås så att proxyn inte blir en öppen relä (NFK-18).
 *  - Prognostidpunkten (`referenceTime`) följer alltid med svaret (FK-18).
 */
import type { Config, Context } from '@netlify/functions';
import { apiError } from '../../shared/api/errors.ts';
import { KOMMUN_BBOX_4326 } from '../../shared/geo/kommun.ts';
import { type SmhiPoint, normalizeForecast, roundCoordinate } from '../lib/smhi.ts';
import { allowedHostsFromEnv, isAllowedCaller } from '../lib/tilesGuard.ts';
import { fetchJson } from '../lib/upstream.ts';

const SMHI = 'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point';
const MARGIN_DEG = 0.05;

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < min - MARGIN_DEG || n > max + MARGIN_DEG) return null;
  return roundCoordinate(n);
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') return apiError('BAD_REQUEST', 'Endast GET stöds.');

  if (!isAllowedCaller(req.headers, allowedHostsFromEnv(process.env))) {
    return apiError('FORBIDDEN', 'Väderproxyn kan bara användas från Norrköpingskartan.');
  }

  const url = new URL(req.url);
  const lon = parseCoordinate(url.searchParams.get('lon'), KOMMUN_BBOX_4326[0], KOMMUN_BBOX_4326[2]);
  const lat = parseCoordinate(url.searchParams.get('lat'), KOMMUN_BBOX_4326[1], KOMMUN_BBOX_4326[3]);
  if (lon === null || lat === null) {
    return apiError('BAD_REQUEST', 'lat och lon krävs och måste ligga inom Norrköpings kommun.');
  }

  try {
    const raw = await fetchJson<SmhiPoint>(`${SMHI}/lon/${lon.toFixed(2)}/lat/${lat.toFixed(2)}/data.json`, { timeoutMs: 8_000, retries: 1 });
    const forecast = normalizeForecast(raw, 12);
    const body = { ...forecast, source: 'SMHI', fetchedAt: new Date().toISOString() };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600, durable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.warn(JSON.stringify({ event: 'vader.upstream_error', message: (err as Error).message }));
    return apiError('UPSTREAM_UNAVAILABLE', 'Väderprognosen kan inte hämtas just nu.', 300);
  }
}

export const config: Config = {
  path: '/projekt/norrkoping/api/vader',
};
