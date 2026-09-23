/**
 * Höjdprofilens rena logik: samplingen längs linjen och statistiken. Ingen DOM, ingen OL —
 * funktionerna är avsiktligt separerade från kontrollen just för att kunna testas.
 */
import { describe, expect, it } from 'vitest';
import { planarLengthIn } from '../../shared/geo/planar.ts';
import { samplePoints, summarize } from './hojdverktyg.ts';

describe('samplePoints', () => {
  it('lägger punkterna jämnt längs en rak linje, inklusive ändpunkterna', () => {
    const pts = samplePoints([[0, 0], [100, 0]], 11, 1);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([100, 0]);
    expect(pts[5]?.[0]).toBeCloseTo(50, 6);
  });

  it('följer alla segment i en bruten linje', () => {
    const coords = [[0, 0], [100, 0], [100, 100]];
    const pts = samplePoints(coords, 5, 1);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual([0, 0]);
    // Halva vägen längs 200 m: precis i knäcken.
    expect(pts[2]?.[0]).toBeCloseTo(100, 6);
    expect(pts[2]?.[1]).toBeCloseTo(0, 6);
    expect(pts[4]?.[0]).toBeCloseTo(100, 6);
    expect(pts[4]?.[1]).toBeCloseTo(100, 6);
  });

  it('respekterar taket för antal punkter — proxyn tar högst 200', () => {
    const pts = samplePoints([[0, 0], [100_000, 0]], 120, 10);
    expect(pts.length).toBeLessThanOrEqual(120);
  });

  it('glesar inte tätare än minsta steglängd på korta linjer', () => {
    const pts = samplePoints([[0, 0], [25, 0]], 120, 10);
    expect(pts).toHaveLength(3); // 25 m / 10 m + 1
  });

  it('ger en enda punkt för en enda koordinat och inget för tom indata', () => {
    expect(samplePoints([[578000, 6497000]])).toEqual([[578000, 6497000]]);
    expect(samplePoints([])).toEqual([]);
  });

  it('hoppar över nollängdssegment (dubbelklick ger dubblerad sista punkt)', () => {
    const pts = samplePoints([[0, 0], [100, 0], [100, 0]], 3, 1);
    expect(pts).toHaveLength(3);
    expect(pts[2]).toEqual([100, 0]);
  });
});

describe('summarize', () => {
  it('räknar lägsta, högsta och summan av alla stigningar', () => {
    expect(summarize([10, 20, 15, 25])).toEqual({ min: 10, max: 25, gain: 20 });
  });

  it('hoppar över punkter utan höjddata utan att räkna dem som fall', () => {
    expect(summarize([10, null, 20])).toEqual({ min: 10, max: 20, gain: 10 });
  });

  it('ger null när ingen punkt har höjd', () => {
    expect(summarize([null, null])).toBeNull();
  });
});

describe('profilens längd', () => {
  it('mäts planärt i SWEREF 99 TM och vägrar Web Mercator (NFK-12)', () => {
    const line: Array<[number, number]> = [[578000, 6497000], [578300, 6497400]];
    expect(planarLengthIn(line, 'EPSG:3006')).toBeCloseTo(500, 6);
    expect(() => planarLengthIn(line, 'EPSG:3857')).toThrow();
  });
});
