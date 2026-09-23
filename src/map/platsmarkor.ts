/**
 * Markör + faktakort för en vald plats ur ortnamnssöket (FK-32) — med koordinater i
 * SWEREF 99 TM och markhöjd från Lantmäteriets *Markhöjd Direkt* (IK-08).
 *
 * Kortet är ett vanligt DOM-element ovanpå kartan, inte en OpenLayers-overlay: det
 * behöver inte följa med vid panorering (markören gör jobbet) och blir då både billigare
 * att rita och läsbart för skärmläsare i dokumentflödet.
 */
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import { Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import { t } from '../i18n/index.ts';
import { hojdAt } from '../lm/hojd.ts';

export interface Plats {
  namn: string;
  typ: string;
  e: number;
  n: number;
}

export interface Platsmarkor {
  show(plats: Plats): void;
  clear(): void;
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function createPlatsmarkor(map: OlMap, host: HTMLElement): Platsmarkor {
  const source = new VectorSource<Feature<Point>>();
  const layer = new VectorLayer({
    source,
    zIndex: 30,
    style: new Style({
      image: new Circle({
        radius: 9,
        fill: new Fill({ color: token('--c-accent', '#0b5d8a') }),
        stroke: new Stroke({ color: token('--c-surface', '#fff'), width: 3 }),
      }),
    }),
  });
  map.addLayer(layer);

  const card = document.createElement('div');
  card.className = 'platskort';
  card.setAttribute('role', 'status');
  card.hidden = true;
  host.appendChild(card);

  let hojdAbort: AbortController | null = null;

  function clear(): void {
    hojdAbort?.abort();
    source.clear();
    card.hidden = true;
    card.replaceChildren();
  }

  function show(plats: Plats): void {
    hojdAbort?.abort();
    hojdAbort = new AbortController();
    const signal = hojdAbort.signal;

    source.clear();
    const feature = new Feature({ geometry: new Point([plats.e, plats.n]) });
    source.addFeature(feature);

    card.replaceChildren();
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'platskort__close';
    close.textContent = '✕';
    close.setAttribute('aria-label', t('plats.close'));
    close.addEventListener('click', clear);

    const title = document.createElement('h2');
    title.className = 'platskort__title';
    title.textContent = plats.namn;

    const meta = document.createElement('p');
    meta.className = 'platskort__meta';
    meta.textContent = plats.typ;

    const facts = document.createElement('dl');
    facts.className = 'platskort__facts';
    const fact = (key: string, value: string): HTMLElement => {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      facts.append(dt, dd);
      return dd;
    };
    // SWEREF 99 TM redovisas som N/E med heltalsmeter, som på en officiell karta (Bilaga B).
    fact(t('plats.coords'), `N ${Math.round(plats.n)}  E ${Math.round(plats.e)}`);
    const hojdValue = fact(t('plats.hojd'), t('plats.hojdLoading'));

    const source_ = document.createElement('p');
    source_.className = 'platskort__source';
    source_.textContent = t('plats.source');

    card.append(close, title, meta, facts, source_);
    card.hidden = false;

    void hojdAt(plats.e, plats.n, signal).then((z) => {
      if (signal.aborted) return;
      hojdValue.textContent = z === null ? t('plats.hojdMissing') : t('plats.hojdValue').replace('{n}', z.toFixed(1));
    });
  }

  return { show, clear };
}
