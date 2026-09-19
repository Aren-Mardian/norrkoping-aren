/**
 * TK-03 — Mätkontroll mot känd sträcka.
 *
 * Kontrollsträckan är exakt 1 000,000 m geodetiskt (GRS80) rakt österut från
 * referenspunkten i Bilaga B.2. Slutpunkten är beräknad med PROJ (pyproj Geod.fwd):
 *   start  16,18590000° Ö, 58,58734000° N
 *   slut   16,20309351° Ö, 58,58733885° N
 * PROJ-referens för planära längder: 3006 → 999,659 m, 3010 → 1 000,004 m, 3857 → 1 913,973 m.
 */
import { describe, expect, it } from 'vitest';
import { EPSG_3006, EPSG_3010, EPSG_3857, EPSG_4326, toSweref991630, toSweref99TM, type LonLat } from './projDefs.ts';
import {
  ProjectionNotMeasurableError,
  geodesicLength,
  lengthInSweref99TM,
  measureLength,
  planarLength,
  planarLengthInWebMercatorForTestOnly,
} from './measure.ts';

const START: LonLat = [16.1859, 58.58734];
const END: LonLat = [16.20309351, 58.58733885];
const LINE: readonly LonLat[] = [START, END];

describe('TK-03 kontrollsträcka 1 000 m', () => {
  it('geodetisk längd på ellipsoiden ger 1 000,000 ± 0,01 m', () => {
    expect(geodesicLength(LINE)).toBeCloseTo(1000, 2);
  });

  it('planär längd i EPSG:3006 ger 999,66 m (−0,03 %), inom kravets ±5 m', () => {
    const len = lengthInSweref99TM(LINE);
    expect(Math.abs(len - 999.659)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(len - 1000)).toBeLessThanOrEqual(5);
  });

  it('planär längd i EPSG:3010 ger 1 000,004 m, inom kravets ±5 m', () => {
    const len = planarLength(LINE.map(toSweref991630));
    expect(Math.abs(len - 1000.004)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(len - 1000)).toBeLessThanOrEqual(5);
  });

  it('measureLength accepterar 3006, 3010 och 4326', () => {
    expect(measureLength(LINE.map(toSweref99TM), EPSG_3006)).toBeCloseTo(999.659, 2);
    expect(measureLength(LINE.map(toSweref991630), EPSG_3010)).toBeCloseTo(1000.004, 2);
    expect(measureLength(LINE, EPSG_4326)).toBeCloseTo(1000, 2);
  });

  it('negativt test: planärt i Web Mercator ger ≈ 1 914 m (+91 %)', () => {
    const wrong = planarLengthInWebMercatorForTestOnly(LINE);
    expect(Math.abs(wrong - 1913.973)).toBeLessThanOrEqual(0.05);
    expect(wrong / 1000).toBeGreaterThan(1.9);
  });

  it('negativt test: implementationen avvisar mätning i EPSG:3857', () => {
    expect(() => measureLength([[0, 0], [1000, 0]], EPSG_3857)).toThrow(ProjectionNotMeasurableError);
  });

  it('bruten linje summerar delsträckor', () => {
    const mid: LonLat = [16.1945, 58.5874];
    const viaMid = geodesicLength([START, mid, END]);
    expect(viaMid).toBeGreaterThanOrEqual(1000);
    expect(viaMid).toBeLessThan(1001);
  });
});
