/**
 * IK-08 — Markhöjd. Lantmäteriets *Markhöjd Direkt* (CC BY 4.0) via appkontot.
 *
 *   GET  /projekt/norrkoping/api/hojd?e=<öst>&n=<norr>     en punkt (SWEREF 99 TM)
 *   POST /projekt/norrkoping/api/hojd  { points: [[e,n]] } upp till 200 punkter (höjdprofil)
 *
 * Appkontot finns bara här (NFK-15); klienten ser aldrig en hemlighet. Origin-lås och
 * bbox-spärr som för tile-proxyn (NFK-18) — höjder utanför kommunen besvaras inte.
 * Höjden är markhöjd i RH 2000; punkter utan data ger `null` i stället för -9999.
 */
import type { Config, Context } from '@netlify/functions';
import { apiError } from '../../shared/api/errors.ts';
import { MAX_POINTS, buildUpstreamBody, buildUpstreamUrl, normalizeHojd, parseBody, parseQueryPoint } from '../lib/hojd.ts';
import { allowedHostsFromEnv, isAllowedCaller } from '../lib/tilesGuard.ts';
import { UpstreamError, fetchUpstream } from '../lib/upstream.ts';

const DEFAULT_BASE = 'https://api.lantmateriet.se/distribution/produkter/markhojd/v1';

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return apiError('BAD_REQUEST', 'Endast GET och POST stöds.');

  if (!isAllowedCaller(req.headers, allowedHostsFromEnv(process.env))) {
    return apiError('FORBIDDEN', 'Höjdproxyn kan bara användas från Norrköpingskartan.');
  }

  const user = process.env['LM_USER'];
  const password = process.env['LM_PASSWORD'];
  if (!user || !password) {
    return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kräver Lantmäteriets appkonto, som inte är konfigurerat.', 60);
  }

  let parsed;
  if (req.method === 'GET') {
    parsed = parseQueryPoint(new URL(req.url).searchParams);
  } else {
    try {
      parsed = parseBody(await req.json());
    } catch {
      return apiError('BAD_REQUEST', 'Kroppen måste vara JSON: { "points": [[e, n], …] }.');
    }
  }
  if (!parsed.ok) return apiError('BAD_REQUEST', parsed.reason);

  const base = process.env['LM_MARKHOJD_URL'] || DEFAULT_BASE;
  const url = buildUpstreamUrl(base);
  const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  const single = parsed.points.length === 1;
  const [first] = parsed.points;

  try {
    // En punkt hämtas med GET (cachevänligt uppströms); flera med ett enda POST-anrop.
    const response = single
      ? await fetchUpstream(`${url}&e=${first?.[0] ?? 0}&n=${first?.[1] ?? 0}`, {
          timeoutMs: 8_000,
          retries: 1,
          headers: { Authorization: auth, Accept: 'application/json' },
        })
      : await fetchUpstream(url, {
          timeoutMs: 12_000,
          retries: 1,
          method: 'POST',
          body: buildUpstreamBody(parsed.points),
          headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
        });

    const points = normalizeHojd(await response.json());
    const body = {
      points,
      crs: 'EPSG:3006',
      heightSystem: 'RH 2000',
      source: 'Lantmäteriet, Markhöjd Direkt',
      license: 'CC BY 4.0',
      fetchedAt: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Markhöjden ändras i praktiken aldrig → cacha länge, men bara för GET (POST cachas inte).
        'Cache-Control': single ? 'public, max-age=86400, s-maxage=604800' : 'no-store',
        ...(single ? { 'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, durable' } : {}),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : undefined;
    console.warn(JSON.stringify({ event: 'hojd.upstream_error', status, points: parsed.points.length, message: (err as Error).message }));
    if (status === 401 || status === 403) return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kräver ett appkonto med behörighet till Markhöjd Direkt.', 300);
    return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kan inte hämtas just nu.', 60);
  }
}

export const config: Config = {
  path: '/projekt/norrkoping/api/hojd',
};

export { MAX_POINTS };
