/**
 * Höjdverktyget i verktygsläget (IK-08): **ett klick, en höjd**.
 *
 * Varje klick i kartan sätter ut en punkt med markhöjden ur Lantmäteriets *Markhöjd Direkt*,
 * i RH 2000. Klicka på nästa ställe för nästa höjd — punkterna ligger kvar tills verktyget
 * stängs av eller rensas. Ingen ritning, inga linjer: den som vill mäta sträckor använder
 * Origos mätverktyg, som redan finns i samma karta.
 *
 * Punkter utanför kommungränsen avvisas direkt i klienten (ADR-16) — då blir det inget anrop
 * alls, och användaren får veta varför på en gång.
 *
 * Verktyget använder Origos egen OpenLayers-instans (`Origo.ol`) — inga OL-importer här, så
 * verktygschunken växer med ett par kB och sidans kritiska väg påverkas inte (TK-05).
 */
import { pointInKommun } from '../../shared/geo/kommunPolygon.ts';
import { t } from '../i18n/index.ts';
import { hojdAt } from '../lm/hojd.ts';

interface OlNamespace {
  geom: { Point: new (coords: number[]) => unknown };
  layer: { Vector: new (opts: Record<string, unknown>) => unknown };
  source: { Vector: new (opts?: Record<string, unknown>) => OlVectorSource };
  style: {
    Style: new (opts: Record<string, unknown>) => unknown;
    Circle: new (opts: Record<string, unknown>) => unknown;
    Fill: new (opts: Record<string, unknown>) => unknown;
    Stroke: new (opts: Record<string, unknown>) => unknown;
    Text: new (opts: Record<string, unknown>) => unknown;
  };
  Feature: new (opts: Record<string, unknown>) => OlFeature;
}

interface OlFeature {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
}
interface OlVectorSource {
  addFeature(f: OlFeature): void;
  clear(): void;
  getFeatures(): OlFeature[];
}
interface OlMapLike {
  addLayer(layer: unknown): void;
  on(type: 'singleclick', listener: (e: { coordinate: number[] }) => void): void;
  un(type: 'singleclick', listener: (e: { coordinate: number[] }) => void): void;
  getTargetElement(): HTMLElement;
}

export interface HojdVerktyg {
  setActive(active: boolean): void;
  isActive(): boolean;
  clear(): void;
}

/** Så många punkter får ligga kvar innan den äldsta försvinner — håller kartan läsbar. */
const MAX_POINTS = 12;

export function createHojdVerktyg(ol: OlNamespace, map: OlMapLike, panel: HTMLElement): HojdVerktyg {
  const source = new ol.source.Vector();

  const style = (feature: OlFeature): unknown =>
    new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: '#0b5d8a' }),
        stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new ol.style.Text({
        text: String(feature.get('label') ?? ''),
        font: 'bold 12px system-ui, sans-serif',
        offsetY: -16,
        padding: [3, 5, 3, 5],
        fill: new ol.style.Fill({ color: '#1d2126' }),
        backgroundFill: new ol.style.Fill({ color: 'rgba(255,255,255,0.92)' }),
        backgroundStroke: new ol.style.Stroke({ color: '#0b5d8a', width: 1 }),
      }),
    });

  // group: 'none' håller resultatlagret utanför teckenförklaringen — som Origos eget mätlager.
  map.addLayer(
    new ol.layer.Vector({ source, style, zIndex: 40, name: 'hojdresultat', title: t('origo.hojd.title'), group: 'none' }),
  );

  const status = document.createElement('p');
  status.className = 'hojd__status';
  status.setAttribute('role', 'status');
  status.textContent = t('origo.hojd.hint');
  status.hidden = true;
  panel.appendChild(status);

  let active = false;
  const pending = new Set<AbortController>();

  function say(message: string): void {
    status.textContent = message;
  }

  function addPoint(coordinate: number[], label: string): OlFeature {
    const feature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
    feature.set('label', label);
    source.addFeature(feature);
    // Äldsta punkten får vika när det blir för många.
    const features = source.getFeatures();
    if (features.length > MAX_POINTS) {
      const oldest = features[0];
      if (oldest) (source as unknown as { removeFeature(f: OlFeature): void }).removeFeature(oldest);
    }
    return feature;
  }

  async function measure(coordinate: number[]): Promise<void> {
    const e = coordinate[0] ?? 0;
    const n = coordinate[1] ?? 0;
    if (!pointInKommun(e, n)) {
      say(t('origo.hojd.outside'));
      return;
    }

    const feature = addPoint([e, n], '…');
    say(t('origo.hojd.loading'));

    const controller = new AbortController();
    pending.add(controller);
    try {
      const z = await hojdAt(e, n, controller.signal);
      if (controller.signal.aborted) return;
      feature.set('label', z === null ? t('origo.hojd.missingShort') : `${z.toFixed(1)} m`);
      say(
        z === null
          ? t('origo.hojd.missing')
          : `${t('origo.hojd.point').replace('{n}', z.toFixed(1))} · N ${Math.round(n)} E ${Math.round(e)} · ${t('origo.hojd.source')}`,
      );
    } finally {
      pending.delete(controller);
    }
  }

  const onClick = (event: { coordinate: number[] }): void => {
    void measure(event.coordinate);
  };

  function clear(): void {
    for (const controller of pending) controller.abort();
    pending.clear();
    source.clear();
    say(t('origo.hojd.hint'));
  }

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        map.on('singleclick', onClick);
        // Hårkors gör det tydligt att kartan väntar på en punkt.
        map.getTargetElement().style.cursor = 'crosshair';
      } else {
        map.un('singleclick', onClick);
        map.getTargetElement().style.cursor = '';
        clear();
      }
      status.hidden = !active;
      say(t('origo.hojd.hint'));
    },
    isActive: () => active,
    clear,
  };
}
