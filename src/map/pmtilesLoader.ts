/**
 * Ramverksoberoende laddning av kartrutor ur en självhostad raster-PMTiles i Lantmäteriets
 * 3006-matris (ADR-06, ADR-09). Används både av landningsvyns OpenLayers (pmtilesSource.ts)
 * och av Origos inbäddade OpenLayers på /verktyg (ADR-11) — därför inga `ol`-importer här.
 *
 * PMTiles kräver att nivå 0 är en enda ruta medan LM:s nivå 0 är 4×4, så filen lagrar
 * LM-nivå z som PMTiles-nivå z + offset (offset läses ur metadata).
 *
 * Saknas en ruta (utanför detaljområdet, eller i panoreringsbufferten på hög zoom) hämtas
 * närmaste förälder och rätt kvadrant skalas upp — kartan blir aldrig tom, bara mindre skarp.
 * Allt sker via Range-requests mot en fil på egen origin: ingen tile-server, ingen token.
 */
import { PMTiles } from 'pmtiles';
import { LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';

/** Hur många nivåer uppåt vi letar efter en förälder innan rutan ges upp. */
const MAX_PARENT_LEVELS = 3;

/** ol/TileState.ERROR — hårdkodat så att modulen kan användas utan `ol`-import. */
const TILE_STATE_ERROR = 3;

export interface PmtilesInfo {
  /** LM-nivå → PMTiles-nivå. */
  zoomOffset: number;
  /** Högsta LM-nivå som finns i filen. */
  maxLmZoom: number;
  /** HTML för attributionskontrollen, med licensen länkad (JK-02). */
  attribution: string;
}

/** Det lilla vi behöver av en OpenLayers-ImageTile, oavsett vilken OL-instans den kommer från. */
export interface ImageTileLike {
  getImage(): HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
  setState(state: number): void;
}

export interface PmtilesTileLoader {
  /** Löser när headern är läst; kastar om filen saknas eller är trasig. */
  ready: Promise<PmtilesInfo>;
  /** Kodar rutkoordinaten som "z/x/y" — det enda vi behöver av en URL. */
  tileUrlFunction(coord: readonly number[]): string;
  /** Hämtar rutan (eller en uppskalad förälder) och sätter den på rutans bild. */
  tileLoadFunction(tile: ImageTileLike, src: string): void;
}

interface Metadata {
  lm_zoom_offset?: number;
  attribution?: string;
  license?: string;
  license_url?: string;
}

/** "© Lantmäteriet, CC BY 4.0" med licensen som länk — villkoren kräver att licensen anges. */
function attributionHtml(meta: Metadata, fallback: string): string {
  const text = meta.attribution ?? fallback;
  if (!meta.license_url) return text;
  const licenseLabel = meta.license?.replace(/-/g, ' ') ?? 'licens';
  const idx = text.indexOf(licenseLabel);
  const link = `<a href="${meta.license_url}" target="_blank" rel="noopener license">${licenseLabel}</a>`;
  return idx === -1 ? `${text} · ${link}` : text.slice(0, idx) + link + text.slice(idx + licenseLabel.length);
}

/** Ritar kvadranten av en föräldraruta uppskalad till en hel ruta. */
async function upscaleFromParent(data: ArrayBuffer, levelsUp: number, x: number, y: number): Promise<Blob> {
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

export function createPmtilesTileLoader(url: string, fallbackAttribution: string): PmtilesTileLoader {
  const pm = new PMTiles(url);
  let offset = 2;

  const ready: Promise<PmtilesInfo> = (async () => {
    const header = await pm.getHeader();
    const meta = (await pm.getMetadata()) as Metadata;
    offset = typeof meta.lm_zoom_offset === 'number' ? meta.lm_zoom_offset : 2;
    return {
      zoomOffset: offset,
      maxLmZoom: header.maxZoom - offset,
      attribution: attributionHtml(meta, fallbackAttribution),
    };
  })();
  // Den som bryr sig lyssnar på `ready`; ett fel här ska inte bli en ohanterad rejection.
  ready.catch(() => undefined);

  async function loadTile(z: number, x: number, y: number): Promise<Blob> {
    const direct = await pm.getZxy(z + offset, x, y);
    if (direct) return new Blob([direct.data], { type: 'image/png' });
    for (let up = 1; up <= MAX_PARENT_LEVELS && z - up >= 0; up++) {
      const parent = await pm.getZxy(z - up + offset, x >> up, y >> up);
      if (parent) return upscaleFromParent(parent.data, up, x, y);
    }
    throw new Error(`Ingen ruta eller förälder för ${z}/${x}/${y}`);
  }

  return {
    ready,
    tileUrlFunction: (coord) => `${coord[0]}/${coord[1]}/${coord[2]}`,
    tileLoadFunction(tile, src) {
      const [z = 0, x = 0, y = 0] = src.split('/').map(Number);
      const image = tile.getImage() as HTMLImageElement;
      loadTile(z, x, y)
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
          image.addEventListener('error', () => URL.revokeObjectURL(objectUrl), { once: true });
          image.src = objectUrl;
        })
        .catch(() => tile.setState(TILE_STATE_ERROR));
    },
  };
}
