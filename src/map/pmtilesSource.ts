/**
 * OpenLayers-källa för landningsvyn ovanpå den ramverksoberoende PMTiles-läsaren
 * (pmtilesLoader.ts). Gridet är Lantmäteriets 3006-matris.
 */
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import type { Tile } from 'ol';
import { LM_3006_EXTENT, LM_3006_ORIGIN, LM_3006_RESOLUTIONS, LM_TILE_SIZE } from '../../shared/geo/lmTileGrid.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import { createPmtilesTileLoader, type ImageTileLike, type PmtilesInfo } from './pmtilesLoader.ts';

export type { PmtilesInfo } from './pmtilesLoader.ts';

export interface PmtilesBasemap {
  source: XYZ;
  /** Löser när headern är läst; kastar om filen saknas eller är trasig. */
  ready: Promise<PmtilesInfo>;
}

function lmTileGrid(): TileGrid {
  return new TileGrid({
    extent: [...LM_3006_EXTENT],
    origin: [...LM_3006_ORIGIN],
    resolutions: [...LM_3006_RESOLUTIONS],
    tileSize: LM_TILE_SIZE,
  });
}

export function createPmtilesBasemap(url: string, fallbackAttribution: string): PmtilesBasemap {
  const loader = createPmtilesTileLoader(url, fallbackAttribution);

  const source = new XYZ({
    projection: EPSG_3006,
    tileGrid: lmTileGrid(),
    attributions: fallbackAttribution,
    maxZoom: 13,
    transition: 0,
    tileUrlFunction: loader.tileUrlFunction,
    tileLoadFunction: (tile: Tile, src: string) => loader.tileLoadFunction(tile as unknown as ImageTileLike, src),
  });

  loader.ready.then((info) => source.setAttributions(info.attribution)).catch(() => undefined);

  return { source, ready: loader.ready };
}
