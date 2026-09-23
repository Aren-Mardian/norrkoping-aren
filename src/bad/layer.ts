/**
 * Badplatslagret på vår egen OpenLayers-karta (FK-15–FK-17).
 *
 * All logik ligger i layerCore.ts, som tar OpenLayers som argument — samma lager byggs med
 * Origos inbyggda kopia när verktygen slås på (ADR-15). Här kopplas bara våra egna importer
 * in, och koordinaterna transformeras till EPSG:3006 en gång.
 */
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import { Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import { EPSG_3006 } from '../geo/olProjections.ts';
import type { Badplats } from './model.ts';
import { createBadLayerCore, type BadLayerCore, type OlKit, type OlMapLike } from './layerCore.ts';

/** Våra OpenLayers-klasser i den form layerCore vill ha dem. */
export const OWN_OL_KIT = {
  Feature,
  Point,
  VectorLayer,
  VectorSource,
  Style,
  Circle,
  Fill,
  Stroke,
  Text,
} as unknown as OlKit;

/** Lägger till EPSG:3006-koordinaten som lagret ritar på. */
export function toXY(sites: readonly Badplats[]): Array<{ site: Badplats; xy: number[] }> {
  return sites.map((site) => ({ site, xy: fromLonLat(site.lonLat, EPSG_3006) }));
}

export interface BadLayer extends Omit<BadLayerCore, 'setSites'> {
  setSites(sites: readonly Badplats[]): void;
}

export function createBadLayer(map: OlMap): BadLayer {
  const core = createBadLayerCore(OWN_OL_KIT, map as unknown as OlMapLike);
  return { ...core, setSites: (sites) => core.setSites(toXY(sites)) };
}
