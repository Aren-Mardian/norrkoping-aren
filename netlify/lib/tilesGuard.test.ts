/**
 * NFK-18 — proxyn får inte bli en öppen relä. Testar vitlista, zoom, bbox och Origin-lås.
 */
import { describe, expect, it } from 'vitest';
import { toSweref99TM } from '../../shared/geo/projDefs.ts';
import { LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import {
  allowedHostsFromEnv,
  buildUpstreamUrl,
  isAllowedCaller,
  parseTileParams,
  tileWithinKommun,
  zoomRangeFromEnv,
  type TileRequest,
} from './tilesGuard.ts';

const ZOOM = { min: 0, max: 14 };

/** Rutindex i standard Web Mercator-XYZ för en lon/lat-punkt på nivå z. */
function wmTileFor(lonLat: readonly [number, number], z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lonLat[1] * Math.PI) / 180;
  return {
    x: Math.floor(((lonLat[0] + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  };
}

/** Rutindex i LM-matrisen för en lon/lat-punkt på nivå z. */
function lmTileFor(lonLat: readonly [number, number], z: number): { x: number; y: number } {
  const [e, n] = toSweref99TM(lonLat);
  const size = LM_3006_RESOLUTIONS[z]! * LM_TILE_SIZE;
  return { x: Math.floor((e - LM_3006_ORIGIN[0]) / size), y: Math.floor((LM_3006_ORIGIN[1] - n) / size) };
}

describe('parseTileParams', () => {
  it('accepterar giltig ruta med och utan filändelse', () => {
    const a = parseTileParams({ layer: 'histortho60', z: '8', y: '120', x: '95.png' }, ZOOM);
    expect(a).toEqual({ ok: true, tile: { layer: 'histortho60', z: 8, x: 95, y: 120, ext: 'png' } });
    const b = parseTileParams({ layer: 'histortho60', z: '8', y: '120', x: '95' }, ZOOM);
    expect(b.ok).toBe(true);
  });

  it('avvisar okänt lager', () => {
    expect(parseTileParams({ layer: 'fastighet', z: '8', y: '1', x: '1' }, ZOOM)).toEqual({
      ok: false,
      reason: 'unknown_layer',
    });
  });

  it('avvisar zoom utanför intervallet', () => {
    expect(parseTileParams({ layer: 'histortho60', z: '14', y: '1', x: '1' }, ZOOM).ok).toBe(false);
    expect(parseTileParams({ layer: 'histortho60', z: '-1', y: '1', x: '1' }, ZOOM).ok).toBe(false);
  });

  it('avvisar index utanför matrisen och skräp i sökvägen', () => {
    expect(parseTileParams({ layer: 'histortho60', z: '0', y: '4', x: '0' }, ZOOM).ok).toBe(false);
    expect(parseTileParams({ layer: 'histortho60', z: '8', y: '1', x: '../../etc' }, ZOOM).ok).toBe(false);
    expect(parseTileParams({ layer: 'histortho60', z: '8', y: '1', x: '1.svg' }, ZOOM).ok).toBe(false);
  });
});

describe('tileWithinKommun (bbox-spärr)', () => {
  it('släpper igenom rutan över Norrköping centrum på nivå 10', () => {
    const { x, y } = lmTileFor([16.1859, 58.58734], 10);
    const tile: TileRequest = { layer: 'histortho60', z: 10, x, y, ext: 'png' };
    expect(tileWithinKommun(tile)).toBe(true);
  });

  it('avvisar rutan över Stockholm på nivå 10', () => {
    const { x, y } = lmTileFor([18.0686, 59.3293], 10);
    expect(tileWithinKommun({ layer: 'histortho60', z: 10, x, y, ext: 'png' })).toBe(false);
  });

  it('avvisar rutan över Göteborg på nivå 8', () => {
    const { x, y } = lmTileFor([11.9746, 57.7089], 8);
    expect(tileWithinKommun({ layer: 'histortho60', z: 8, x, y, ext: 'png' })).toBe(false);
  });

  it('släpper igenom en översiktsruta som täcker kommunen', () => {
    const { x, y } = lmTileFor([16.1859, 58.58734], 2);
    expect(tileWithinKommun({ layer: 'histortho60', z: 2, x, y, ext: 'png' })).toBe(true);
  });

  it('fallback-lagret (3857) spärras på samma sätt', () => {
    const nkpg = wmTileFor([16.1859, 58.58734], 10);
    const sthlm = wmTileFor([18.0686, 59.3293], 10);
    expect(tileWithinKommun({ layer: 'osm', z: 10, ...nkpg, ext: 'png' })).toBe(true);
    expect(tileWithinKommun({ layer: 'osm', z: 10, ...sthlm, ext: 'png' })).toBe(false);
  });
});

describe('isAllowedCaller (Origin/Referer-lås)', () => {
  const hosts = new Set(['arenm.se', 'www.arenm.se']);

  it('accepterar same-origin enligt Sec-Fetch-Site', () => {
    expect(isAllowedCaller(new Headers({ 'sec-fetch-site': 'same-origin' }), hosts)).toBe(true);
  });

  it('accepterar Referer från tillåten värd', () => {
    expect(isAllowedCaller(new Headers({ referer: 'https://arenm.se/projekt/norrkoping/' }), hosts)).toBe(true);
    expect(isAllowedCaller(new Headers({ origin: 'https://www.arenm.se' }), hosts)).toBe(true);
  });

  it('avvisar annan värd, subdomänsförfalskning och saknade headers', () => {
    expect(isAllowedCaller(new Headers({ referer: 'https://evil.example/' }), hosts)).toBe(false);
    expect(isAllowedCaller(new Headers({ referer: 'https://arenm.se.evil.example/' }), hosts)).toBe(false);
    expect(isAllowedCaller(new Headers({ referer: 'not a url' }), hosts)).toBe(false);
    expect(isAllowedCaller(new Headers(), hosts)).toBe(false);
  });
});

describe('miljöläsning', () => {
  it('bygger vitlista och lägger till localhost utanför produktion', () => {
    const hosts = allowedHostsFromEnv({
      TILES_ALLOWED_HOSTS: 'arenm.se, www.arenm.se',
      URL: 'https://norrkopingskartan.netlify.app',
      DEPLOY_PRIME_URL: 'https://deploy-preview-3--norrkopingskartan.netlify.app',
      CONTEXT: 'deploy-preview',
    });
    expect(hosts).toEqual(
      new Set([
        'arenm.se',
        'www.arenm.se',
        'norrkopingskartan.netlify.app',
        'deploy-preview-3--norrkopingskartan.netlify.app',
        'localhost',
        '127.0.0.1',
      ]),
    );
  });

  it('släpper inte in localhost i produktion', () => {
    expect(allowedHostsFromEnv({ TILES_ALLOWED_HOSTS: 'arenm.se', CONTEXT: 'production' }).has('localhost')).toBe(false);
  });

  it('zoomintervall har säkra standardvärden', () => {
    expect(zoomRangeFromEnv({})).toEqual({ min: 0, max: 14 });
    expect(zoomRangeFromEnv({ TILES_ZOOM_MIN: '3', TILES_ZOOM_MAX: '12' })).toEqual({ min: 3, max: 12 });
  });

  it('WMS-lagret får GetMap med rutans bbox i EPSG:3006', () => {
    const tile: TileRequest = { layer: 'histortho60', z: 5, x: 7, y: 9, ext: 'jpg' };
    const url = new URL(buildUpstreamUrl(tile, {}));
    expect(url.origin + url.pathname).toBe('https://maps.lantmateriet.se/historiska-ortofoton/wms/v1');
    expect(url.searchParams.get('REQUEST')).toBe('GetMap');
    expect(url.searchParams.get('SRS')).toBe('EPSG:3006');
    expect(url.searchParams.get('LAYERS')).toBe('OI.Histortho_60');
    expect(url.searchParams.get('FORMAT')).toBe('image/jpeg');
    // z5: 128 m/px × 256 = 32 768 m per ruta; x=7 → minx = −1 200 000 + 7·32 768; y=9 → maxy = 8 500 000 − 9·32 768
    expect(url.searchParams.get('BBOX')).toBe('-970624.000,8172320.000,-937856.000,8205088.000');
    expect(buildUpstreamUrl(tile, { LM_HISTORTHO_LAYER_60: 'OI.Histortho_bw_2000' })).toContain('LAYERS=OI.Histortho_bw_2000');
  });

  it('varje flygbildsårgång har sitt eget lagernamn och sin egen miljövariabel', () => {
    const tile = (layer: 'histortho60' | 'histortho75'): TileRequest => ({ layer, z: 5, x: 7, y: 9, ext: 'jpg' });
    expect(buildUpstreamUrl(tile('histortho60'), {})).toContain('LAYERS=OI.Histortho_60');
    expect(buildUpstreamUrl(tile('histortho75'), {})).toContain('LAYERS=OI.Histortho_75');
    // Rutans utbredning beror bara på matrisen, inte på årgången.
    const bbox = (layer: 'histortho60' | 'histortho75'): string | null =>
      new URL(buildUpstreamUrl(tile(layer), {})).searchParams.get('BBOX');
    expect(bbox('histortho60')).toBe(bbox('histortho75'));
    // Det gamla, odelade lagernamnet finns inte längre och ska avvisas.
    expect(parseTileParams({ layer: 'histortho', z: '8', y: '120', x: '95' }, ZOOM).ok).toBe(false);
  });

  it('XYZ-mallen kan överstyras från miljön', () => {
    const tile: TileRequest = { layer: 'osm', z: 5, x: 7, y: 9, ext: 'png' };
    expect(buildUpstreamUrl(tile, {})).toBe('https://tile.openstreetmap.org/5/7/9.png');
    expect(buildUpstreamUrl(tile, { OSM_TEMPLATE: 'https://x.test/{z}/{x}/{y}' })).toBe('https://x.test/5/7/9');
  });
});
