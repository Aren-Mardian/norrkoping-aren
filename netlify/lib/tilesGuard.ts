/**
 * Ren, testbar logik för tile-proxyn (IK-01, NFK-18): parametertolkning,
 * lagervitlista, zoomintervall, bbox-spärr och Origin/Referer-lås.
 * Ingen I/O här — handlern i functions/tiles.mts gör anropet.
 */
import { PAN_LIMIT_3006, PAN_LIMIT_3857, extentsIntersect } from '../../shared/geo/kommun.ts';
import { lmMatrixSize, lmTileExtent, webMercatorTileExtent } from '../../shared/geo/lmTileGrid.ts';

export type LayerId = 'topowebb' | 'ortofoto' | 'osm';

export interface LayerSpec {
  /** Tile-matrisens referenssystem: LM:s 3006-matris eller standard Web Mercator. */
  grid: '3006' | '3857';
  /** Miljövariabel som kan överstyra URL-mallen ({z}, {x}, {y} ersätts). */
  templateEnv: string;
  defaultTemplate: string;
  /** Om anropet ska signeras med Lantmäteriets appkonto. */
  requiresLmAuth: boolean;
  /** Största zoomnivå som finns i matrisen. */
  maxZoom: number;
  /** Identifierar appen mot uppströmstjänsten (OSM:s tile-policy kräver en tydlig User-Agent). */
  userAgent: string;
}

const UA = 'Norrkopingskartan/0.1 (+https://arenm.se/projekt/norrkoping)';

export const LAYERS: Readonly<Record<LayerId, LayerSpec>> = {
  topowebb: {
    grid: '3006',
    templateEnv: 'LM_TOPOWEBB_TEMPLATE',
    defaultTemplate:
      'https://maps.lantmateriet.se/topowebb/v1.1/wmts/1.0.0/topowebb/default/3006/{z}/{y}/{x}.png',
    requiresLmAuth: true,
    maxZoom: 15,
    userAgent: UA,
  },
  ortofoto: {
    grid: '3006',
    templateEnv: 'LM_ORTOFOTO_TEMPLATE',
    defaultTemplate:
      'https://maps.lantmateriet.se/ortofoto/v1.1/wmts/1.0.0/Ortofoto_0.5/default/3006/{z}/{y}/{x}.png',
    requiresLmAuth: true,
    maxZoom: 15,
    userAgent: UA,
  },
  // Fallback-bakgrund (NFK-25). Proxas för att CSP:n bara tillåter egen origin (NFK-16)
  // och för att besökarens IP inte ska nå tredje part (NFK-23). Låg volym: används
  // bara när Lantmäteriet inte svarar. Ska på sikt ersättas av självhostade PMTiles (ADR-06).
  osm: {
    grid: '3857',
    templateEnv: 'OSM_TEMPLATE',
    defaultTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    requiresLmAuth: false,
    maxZoom: 17,
    userAgent: UA,
  },
};

export function isLayerId(value: string): value is LayerId {
  return Object.hasOwn(LAYERS, value);
}

export interface TileRequest {
  layer: LayerId;
  z: number;
  x: number;
  y: number;
  ext: 'png' | 'jpg' | 'jpeg' | 'webp';
}

export interface ZoomRange {
  min: number;
  max: number;
}

export type ParseResult = { ok: true; tile: TileRequest } | { ok: false; reason: string };

const INT = /^\d{1,6}$/;
const EXT = /^(\d{1,6})(?:\.(png|jpe?g|webp))?$/;

/**
 * Tolkar :layer/:z/:y/:x(.ext) och avvisar allt som inte är en giltig ruta i
 * det tillåtna zoomintervallet och inom matrisens storlek.
 */
export function parseTileParams(
  params: Readonly<Record<string, string | undefined>>,
  zoom: ZoomRange,
): ParseResult {
  const layer = params['layer'] ?? '';
  if (!isLayerId(layer)) return { ok: false, reason: 'unknown_layer' };
  const spec = LAYERS[layer];

  const zStr = params['z'] ?? '';
  const yStr = params['y'] ?? '';
  const xRaw = params['x'] ?? '';
  const xMatch = EXT.exec(xRaw);
  if (!INT.test(zStr) || !INT.test(yStr) || !xMatch) return { ok: false, reason: 'malformed' };

  const z = Number(zStr);
  const y = Number(yStr);
  const x = Number(xMatch[1]);
  const extRaw = xMatch[2] ?? 'png';
  const ext: TileRequest['ext'] = extRaw === 'jpeg' ? 'jpg' : (extRaw as TileRequest['ext']);

  if (z < zoom.min || z > zoom.max || z > spec.maxZoom) return { ok: false, reason: 'zoom_out_of_range' };

  const size = spec.grid === '3006' ? lmMatrixSize(z) : 2 ** z;
  if (x >= size || y >= size) return { ok: false, reason: 'tile_out_of_matrix' };

  return { ok: true, tile: { layer, z, x, y, ext } };
}

/** Rutan måste skära kommunens buffrade bbox (NFK-18). */
export function tileWithinKommun(tile: TileRequest): boolean {
  const spec = LAYERS[tile.layer];
  if (spec.grid === '3006') return extentsIntersect(lmTileExtent(tile.z, tile.x, tile.y), PAN_LIMIT_3006);
  return extentsIntersect(webMercatorTileExtent(tile.z, tile.x, tile.y), PAN_LIMIT_3857);
}

export function buildUpstreamUrl(tile: TileRequest, env: Readonly<Record<string, string | undefined>>): string {
  const spec = LAYERS[tile.layer];
  const template = env[spec.templateEnv] || spec.defaultTemplate;
  return template.replace('{z}', String(tile.z)).replace('{y}', String(tile.y)).replace('{x}', String(tile.x));
}

/**
 * Origin/Referer-lås. Accepterar om webbläsaren själv intygar same-origin
 * (Sec-Fetch-Site, kan inte sättas från en webbsida) eller om Origin/Referer
 * pekar på en tillåten värd. Saknas allt → avslag; proxyn får inte bli öppen relä.
 */
export function isAllowedCaller(headers: Headers, allowedHosts: ReadonlySet<string>): boolean {
  if (headers.get('sec-fetch-site') === 'same-origin') return true;
  const candidate = headers.get('origin') ?? headers.get('referer');
  if (!candidate) return false;
  try {
    return allowedHosts.has(new URL(candidate).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Bygger vitlistan av värdnamn från miljön. Preview- och dev-miljöer får localhost. */
export function allowedHostsFromEnv(env: Readonly<Record<string, string | undefined>>): Set<string> {
  const hosts = new Set<string>();
  for (const h of (env['TILES_ALLOWED_HOSTS'] ?? '').split(',')) {
    const t = h.trim().toLowerCase();
    if (t) hosts.add(t);
  }
  for (const key of ['URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL']) {
    const v = env[key];
    if (!v) continue;
    try {
      hosts.add(new URL(v).hostname.toLowerCase());
    } catch {
      /* ogiltig URL i miljön ignoreras */
    }
  }
  if (env['CONTEXT'] !== 'production') {
    hosts.add('localhost');
    hosts.add('127.0.0.1');
  }
  return hosts;
}

export function zoomRangeFromEnv(env: Readonly<Record<string, string | undefined>>): ZoomRange {
  const min = Number.parseInt(env['TILES_ZOOM_MIN'] ?? '0', 10);
  const max = Number.parseInt(env['TILES_ZOOM_MAX'] ?? '14', 10);
  return {
    min: Number.isFinite(min) ? Math.max(0, min) : 0,
    max: Number.isFinite(max) ? max : 14,
  };
}
