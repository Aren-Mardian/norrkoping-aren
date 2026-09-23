/**
 * Registrerar SWEREF 99 TM (3006) i OpenLayers via proj4 — sajtens enda referenssystem (ADR-18).
 * Definitionerna kommer från shared/geo/projDefs.ts så att klient, edge och test
 * använder exakt samma parametrar (NFK-13).
 */
import { get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import { EPSG_3006, EXTENT_3006, registerProjDefs } from '../../shared/geo/projDefs.ts';

export { EPSG_3006 };

let done = false;

export function registerOlProjections(): void {
  if (done) return;
  register(registerProjDefs());
  const p3006 = getProjection(EPSG_3006);
  if (!p3006) throw new Error(`${EPSG_3006} kunde inte registreras i OpenLayers`);
  p3006.setExtent([...EXTENT_3006]);
  done = true;
}
