/**
 * IK-01 — Tile-proxy. GET /projekt/norrkoping/api/tiles/:layer/:z/:y/:x(.ext)
 *
 * Enda platsen där Lantmäteriets appkonto får finnas (arkitekturprincip A2).
 *  - Signerar mot Lantmäteriet med uppgifter som bara finns i miljövariabler.
 *  - Tillåter enbart vitlistade lager och zoomnivåer (NFK-18).
 *  - Avvisar rutor utanför kommunens buffrade bbox med 400.
 *  - Sätter s-maxage ≥ 7 dygn + stale-while-revalidate (NFK-04).
 *  - Svarar 503 + Retry-After vid uppströmsfel, aldrig 200 med trasig bild.
 *  - Vidarebefordrar inte besökarens IP (NFK-23) och loggar aldrig full IP (IK-05).
 */
import type { Config, Context } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { apiError } from '../../shared/api/errors.ts';
import { createRateLimiter } from '../lib/rateLimit.ts';
import {
  LAYERS,
  allowedHostsFromEnv,
  buildUpstreamUrl,
  isAllowedCaller,
  parseTileParams,
  tileWithinKommun,
  zoomRangeFromEnv,
} from '../lib/tilesGuard.ts';

const UPSTREAM_TIMEOUT_MS = 5_000;
const RETRY_AFTER_S = 60;
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';
const CDN_CACHE_CONTROL = 'public, s-maxage=604800, stale-while-revalidate=86400, durable';

// 600 rutor/min per anropare: en kartvy är ~30 rutor, så det räcker gott för
// riktig användning men stoppar massnedladdning.
const limiter = createRateLimiter(600, 60_000);

/** Kort hash av IP för loggning — aldrig full IP (IK-05). */
function ipHash(ip: string | undefined): string {
  return createHash('sha256')
    .update(ip ?? 'unknown')
    .digest('hex')
    .slice(0, 12);
}

function log(event: string, fields: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event, ...fields }));
}

function lmAuthHeader(env: Readonly<Record<string, string | undefined>>): string | undefined {
  const bearer = env['LM_BEARER_TOKEN'];
  if (bearer) return `Bearer ${bearer}`;
  const user = env['LM_USER'];
  const password = env['LM_PASSWORD'];
  if (user && password) return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
  return undefined;
}

export default async function handler(req: Request, context: Context): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return apiError('BAD_REQUEST', 'Endast GET stöds.');
  }

  const env = process.env;
  const caller = ipHash(context.ip);

  if (!limiter.allow(caller)) {
    log('tiles.rate_limited', { caller });
    return apiError('RATE_LIMITED', 'För många anrop. Försök igen om en stund.', RETRY_AFTER_S);
  }

  if (!isAllowedCallerCached(req.headers, env)) {
    log('tiles.rejected', { caller, reason: 'origin' });
    return apiError('FORBIDDEN', 'Proxyn kan bara användas från Norrköpingskartan.');
  }

  const parsed = parseTileParams(context.params, zoomRangeFromEnv(env));
  if (!parsed.ok) {
    log('tiles.rejected', { caller, reason: parsed.reason });
    return apiError('BAD_REQUEST', 'Ogiltig ruta: okänt lager, zoomnivå eller index.');
  }
  const { tile } = parsed;

  if (!tileWithinKommun(tile)) {
    log('tiles.rejected', { caller, reason: 'bbox', layer: tile.layer, z: tile.z });
    return apiError('BAD_REQUEST', 'Rutan ligger utanför Norrköpings kommun.');
  }

  const spec = LAYERS[tile.layer];
  const headers = new Headers({ 'User-Agent': spec.userAgent, Accept: 'image/*' });
  if (spec.requiresLmAuth) {
    const auth = lmAuthHeader(env);
    if (!auth) {
      // Inte ett uppströmsfel utan saknad konfiguration — men klienten ska
      // behandla det likadant: byt till fallback-bakgrund (NFK-25).
      return apiError('NOT_CONFIGURED', 'Bakgrundskartan är inte konfigurerad i den här miljön.', 3600);
    }
    headers.set('Authorization', auth);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(buildUpstreamUrl(tile, env), { headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    log('tiles.upstream_error', { caller, layer: tile.layer, z: tile.z, kind: (err as Error).name });
    return apiError('UPSTREAM_UNAVAILABLE', 'Kartservern svarar inte just nu.', RETRY_AFTER_S);
  }
  clearTimeout(timer);

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) {
    log('tiles.upstream_bad', { caller, layer: tile.layer, z: tile.z, status: upstream.status });
    await upstream.body?.cancel();
    return apiError('UPSTREAM_UNAVAILABLE', 'Kartservern svarar inte just nu.', RETRY_AFTER_S);
  }

  const out = new Headers({
    'Content-Type': contentType,
    'Cache-Control': CACHE_CONTROL,
    'Netlify-CDN-Cache-Control': CDN_CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('content-length');
  if (length) out.set('Content-Length', length);

  return new Response(req.method === 'HEAD' ? null : upstream.body, { status: 200, headers: out });
}

let allowedHostsCache: { key: string; hosts: Set<string> } | undefined;

function isAllowedCallerCached(headers: Headers, env: Readonly<Record<string, string | undefined>>): boolean {
  const key = `${env['TILES_ALLOWED_HOSTS'] ?? ''}|${env['URL'] ?? ''}|${env['DEPLOY_PRIME_URL'] ?? ''}|${env['CONTEXT'] ?? ''}`;
  if (!allowedHostsCache || allowedHostsCache.key !== key) {
    allowedHostsCache = { key, hosts: allowedHostsFromEnv(env) };
  }
  return isAllowedCaller(headers, allowedHostsCache.hosts);
}

export const config: Config = {
  path: '/projekt/norrkoping/api/tiles/:layer/:z/:y/:x',
};
