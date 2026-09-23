/**
 * IK-08 — Markhöjd. Lantmäteriets *Markhöjd Direkt* (CC BY 4.0) via appkontot.
 *
 *   GET /projekt/norrkoping/api/hojd?e=<öst>&n=<norr>   en punkt i SWEREF 99 TM
 *
 * Appkontot finns bara här (NFK-15); klienten ser aldrig en hemlighet. Origin-lås som för
 * tile-proxyn, och punkten måste ligga **innanför kommungränsen** — inte bara inom dess bbox
 * (ADR-16, NFK-18). Höjden är markhöjd i RH 2000; punkter utan data ger `null` i stället för -9999.
 */
import type { Config, Context } from '@netlify/functions';
import { apiError } from '../../shared/api/errors.ts';
import { buildUpstreamUrl, normalizeHojd, parseQueryPoint } from '../lib/hojd.ts';
import { allowedHostsFromEnv, isAllowedCaller } from '../lib/tilesGuard.ts';
import { UpstreamError, fetchUpstream } from '../lib/upstream.ts';

const DEFAULT_BASE = 'https://api.lantmateriet.se/distribution/produkter/markhojd/v1';

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') return apiError('BAD_REQUEST', 'Endast GET stöds.');

  if (!isAllowedCaller(req.headers, allowedHostsFromEnv(process.env))) {
    return apiError('FORBIDDEN', 'Höjdproxyn kan bara användas från Norrköpingskartan.');
  }

  const user = process.env['LM_USER'];
  const password = process.env['LM_PASSWORD'];
  if (!user || !password) {
    return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kräver Lantmäteriets appkonto, som inte är konfigurerat.', 60);
  }

  const parsed = parseQueryPoint(new URL(req.url).searchParams);
  if (!parsed.ok) return apiError('BAD_REQUEST', parsed.reason);
  const [point] = parsed.points;
  if (!point) return apiError('BAD_REQUEST', 'e och n krävs (SWEREF 99 TM).');

  const base = process.env['LM_MARKHOJD_URL'] || DEFAULT_BASE;
  const url = `${buildUpstreamUrl(base)}&e=${point[0]}&n=${point[1]}`;

  try {
    const response = await fetchUpstream(url, {
      timeoutMs: 8_000,
      retries: 1,
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
        Accept: 'application/json',
      },
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
        // Markhöjden ändras i praktiken aldrig → cacha länge.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, durable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : undefined;
    console.warn(JSON.stringify({ event: 'hojd.upstream_error', status, message: (err as Error).message }));
    if (status === 401 || status === 403) return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kräver ett appkonto med behörighet till Markhöjd Direkt.', 300);
    return apiError('UPSTREAM_UNAVAILABLE', 'Höjddata kan inte hämtas just nu.', 60);
  }
}

export const config: Config = {
  path: '/projekt/norrkoping/api/hojd',
};
