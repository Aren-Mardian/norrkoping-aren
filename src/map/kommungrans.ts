/**
 * Kommungränsen som eget lager (FK-05): synlig i alla bakgrundslägen, kan tändas/släckas.
 *
 * Data: data/derived/kommungrans.geojson (EPSG:4326, OpenStreetMap/ODbL tills Lantmäteriets
 * polygon finns). Laddas efter första ramen — den ligger inte i kritisk väg (A4).
 * Färgerna hämtas från designtokens så att ljust/mörkt läge följer med (UX-05).
 */
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import { KOMMUNGRANS_URL } from '../config/site.ts';
import { EPSG_3006 } from '../geo/olProjections.ts';
import { t } from '../i18n/index.ts';

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function boundaryStyle(): Style[] {
  return [
    new Style({ stroke: new Stroke({ color: token('--c-boundary-halo', 'rgba(255,255,255,0.7)'), width: 5 }) }),
    new Style({ stroke: new Stroke({ color: token('--c-boundary', '#7b2cbf'), width: 2, lineDash: [8, 4] }) }),
  ];
}

export function createKommungransLayer(): VectorLayer<VectorSource> {
  const source = new VectorSource({
    url: KOMMUNGRANS_URL,
    format: new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: EPSG_3006 }),
    attributions: t('attribution.osm'),
  });
  const layer = new VectorLayer({
    source,
    style: boundaryStyle(),
    zIndex: 10,
    // En enda polygon: rendera inte om under animation, det håller panoreringen mjuk (NFK-05).
    updateWhileAnimating: false,
    updateWhileInteracting: false,
  });
  // Följ byte mellan ljust och mörkt läge.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => layer.setStyle(boundaryStyle()));
  return layer;
}
