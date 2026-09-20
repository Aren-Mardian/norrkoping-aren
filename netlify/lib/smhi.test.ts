/** IK-03 / FK-18 — normalisering av SMHI:s snow1g-svar (riktigt, trimmat svar från 2026-09-20). */
import { describe, expect, it } from 'vitest';
import raw from './__fixtures__/smhi-snow1g.json';
import { type SmhiPoint, normalizeForecast, roundCoordinate } from './smhi.ts';

describe('normalizeForecast', () => {
  it('plockar ut timmar från "nu" med de fält vädermodulen visar', () => {
    const now = new Date('2026-09-20T07:10:00Z');
    const f = normalizeForecast(raw as SmhiPoint, 3, now);
    expect(f.referenceTime).toBe('2026-09-20T05:30:00Z');
    expect(f.point).toEqual([16.2, 58.6]);
    expect(f.hours).toHaveLength(3);
    // innevarande timme (07:00) tas med, 06:00 inte
    expect(f.hours[0]?.time).toBe('2026-09-20T07:00:00Z');
    const h = f.hours[0]!;
    expect(typeof h.tempC).toBe('number');
    expect(typeof h.windMs).toBe('number');
    expect(h.precipProb).not.toBeNull();
    expect(h.symbol).toBeGreaterThanOrEqual(1);
    expect(h.symbol).toBeLessThanOrEqual(27);
  });

  it('tål tomt eller trasigt svar', () => {
    expect(normalizeForecast({}, 12).hours).toEqual([]);
    expect(normalizeForecast({ timeSeries: [{ time: 'x', data: {} }] }, 12).hours[0]?.tempC ?? null).toBeNull();
  });

  it('avrundar koordinater till 2 decimaler (IK-03)', () => {
    expect(roundCoordinate(16.185912)).toBe(16.19);
    expect(roundCoordinate(58.58734)).toBe(58.59);
  });
});
