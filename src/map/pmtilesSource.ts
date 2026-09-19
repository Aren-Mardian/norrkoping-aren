/**
 * OpenLayers-källa för självhostade raster-PMTiles i Lantmäteriets 3006-matris (ADR-06, ADR-09).
 *
 * Filen är ett utsnitt av "Topografisk webbkarta Nedladdning, raster" skapat med
 * tools/extract_topowebb.py. PMTiles kräver att nivå 0 är en enda ruta medan LM:s nivå 0
 * är 4×4, så filen lagrar LM-nivå z som PMTiles-nivå z + offset (offset läses ur metadata).
 *
 * Saknas en ruta (utanför detaljområdet, eller i panoreringsbufferten på hög zoom) hämtas
 * närmaste förälder och rätt kvadrant skalas upp — kartan blir aldrig tom, bara mindre skarp.
 * Allt sker via Range-requests mot en fil på egen origin: ingen tile-server, ingen token.
 */
import type ImageTile from 'ol/ImageTile';
import TileState from 'ol/TileState';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import type { Tile } from 'ol';
import { PMTiles } from 'pmtiles';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';

/** Hur många nivåer uppåt vi letar efter en förälder innan rutan ges upp. */
const MAX_PARENT_LEVELS = 3;

export interface PmtilesInfo {
  /** LM-nivå → PMTiles-nivå. */
  zoomOffset: number;
  /** Högsta LM-nivå som finns i filen. */
  maxLmZoom: number;
  attribution: string;
}

export interface PmtilesBasemap {
  source: XYZ;
  /** Löser när headern är läst; kastar om filen saknas eller är trasig. */
  ready: Promise<PmtilesInfo>;
}

interface Metadata {
  lm_zoom_offset?: number;
  attribution?: string;
  license?: string;
  license_url?: string;
}

/** "© Lantmäteriet, CC BY 4.0" med licensen som länk — villkoren kräver att licensen anges (JK-02). */
function attributionHtml(meta: Metadata, fallback: string): string {
  const text = meta.attribution ?? fallback;
  if (!meta.license_url) return text;
  const licenseLabel = meta.license?.replace(/-/g, ' ') ?? 'licens';
  const idx = text.indexOf(licenseLabel);
  const link = `<a href="${meta.license_url}" target="_blank" rel="noopener license">${licenseLabel}</a>`;
  return idx === -1 ? `${text} · ${link}` : text.slice(0, idx) + link + text.slice(idx + licenseLabel.length);
}

function lmTileGrid(): TileGrid {
  return new TileGrid({
    extent: [...LM_3006_EXTENT],
    origin: [...LM_3006_ORIGIN],
    resolutions: [...LM_3006_RESOLUTIONS],
    tileSize: LM_TILE_SIZE,
  });
}

/** Ritar kvadranten av en föräldraruta uppskalad till en hel ruta. */
async function upscaleFromParent(
  data: ArrayBuffer,
  levelsUp: number,
  x: number,
  y: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(new Blob([data]));
  const part = LM_TILE_SIZE / 2 ** levelsUp;
  const sx = (x % 2 ** levelsUp) * part;
  const sy = (y % 2 ** levelsUp) * part;
  const canvas = document.createElement('canvas');
  canvas.width = LM_TILE_SIZE;
  canvas.height = LM_TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D saknas');
  ctx.drawImage(bitmap, sx, sy, part, part, 0, 0, LM_TILE_SIZE, LM_TILE_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob misslyckades'))), 'image/png');
  });
}

export function createPmtilesBasemap(url: string, fallbackAttribution: string): PmtilesBasemap {
  const pm = new PMTiles(url);
  let offset = 2;
  let maxLmZoom = 13;

  const ready: Promise<PmtilesInfo> = (async () => {
    const header = await pm.getHeader();
    const meta = (await pm.getMetadata()) as Metadata;
    offset = typeof meta.lm_zoom_offset === 'number' ? meta.lm_zoom_offset : 2;
    maxLmZoom = header.maxZoom - offset;
    return { zoomOffset: offset, maxLmZoom, attribution: attributionHtml(meta, fallbackAttribution) };
  })();

  async function loadTile(z: number, x: number, y: number): Promise<Blob> {
    const direct = await pm.getZxy(z + offset, x, y);
    if (direct) return new Blob([direct.data], { type: 'image/png' });
    for (let up = 1; up <= MAX_PARENT_LEVELS && z - up >= 0; up++) {
      const parent = await pm.getZxy(z - up + offset, x >> up, y >> up);
      if (parent) return upscaleFromParent(parent.data, up, x, y);
    }
    throw new Error(`Ingen ruta eller förälder för ${z}/${x}/${y}`);
  }

  const source = new XYZ({
    projection: EPSG_3006,
    tileGrid: lmTileGrid(),
    attributions: fallbackAttribution,
    maxZoom: 13,
    transition: 0,
    tileUrlFunction: (coord) => `${coord[0]}/${coord[1]}/${coord[2]}`,
    tileLoadFunction: (tile: Tile, src: string) => {
      const [z = 0, x = 0, y = 0] = src.split('/').map(Number);
      const image = (tile as ImageTile).getImage() as HTMLImageElement;
      loadTile(z, x, y)
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
          image.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
          image.src = objectUrl;
        })
        .catch(() => tile.setState(TileState.ERROR));
    },
  });

  // Saknas filen hanteras det av den som väntar på `ready` — här ska inget bubbla upp som ohanterat fel.
  ready.then((info) => source.setAttributions(info.attribution)).catch(() => undefined);

  return { source, ready };
}
