/**
 * IK-02 — normalisering av HaV:s svar, mot riktiga (trimmade) svar från 2026-09-20.
 * TK-04-frö: avrådan följer alltid med och ger alltid nivån "bad".
 */
import { describe, expect, it } from 'vitest';
import lindo from './__fixtures__/hav-lindobadet.json';
import motala from './__fixtures__/hav-motala-strom.json';
import plask from './__fixtures__/hav-plaskdammen.json';
import { type HavDetail, normalizeDetail, statusLevel } from './hav.ts';

describe('normalizeDetail', () => {
  it('Lindöbadet: ej klassificerad, senaste prov med datum, temperatur och alger', () => {
    const s = normalizeDetail(lindo as HavDetail);
    expect(s.havId).toBe('SE0230581000001732');
    expect(s.name).toBe('Bråviken, Lindöbadet');
    expect(s.classification).toBe('ej klassificerat');
    expect(s.classificationSeason).toBeNull();
    expect(s.latestSample).not.toBeNull();
    expect(s.latestSample?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(['tjänligt', 'tjänligt med anmärkning', 'otjänligt']).toContain(s.latestSample?.result);
    expect(s.waterTemperatureC).toBe(16);
    expect(s.waterTemperatureAt).toBe(s.latestSample?.date);
    expect(s.algae.status).toBe('ingen');
    expect(s.advisory).toBeNull();
  });

  it('plaskdammen: avrådan på grund av otjänligt prov', () => {
    const s = normalizeDetail(plask as HavDetail);
    expect(s.advisory).toEqual({
      type: 'otjänligt',
      text: 'E.coli 1300 MPN/100 ml',
      since: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(statusLevel(s)).toBe('bad');
  });

  it('Motala ström: avrådan på grund av algblomning', () => {
    const s = normalizeDetail(motala as HavDetail);
    expect(s.advisory?.type).toBe('alger');
    expect(statusLevel(s)).toBe('bad');
  });

  it('senaste provet väljs efter datum, inte efter ordning i listan', () => {
    const d: HavDetail = {
      nutsCode: 'X',
      testResult: [
        { sampleDate: Date.UTC(2026, 5, 1), sampleValue: 3, algalValue: 4 },
        { sampleDate: Date.UTC(2026, 7, 1), sampleValue: 1, algalValue: 4, tempValue: '18,5' },
      ],
    };
    const s = normalizeDetail(d);
    expect(s.latestSample?.date).toBe('2026-08-01');
    expect(s.latestSample?.result).toBe('tjänligt');
    expect(s.waterTemperatureC).toBe(18.5);
    expect(statusLevel(s)).toBe('ok');
  });

  it('klassificering: bara riktiga koder (1–4) räknas, senaste säsong vinner', () => {
    const d: HavDetail = {
      nutsCode: 'X',
      qualityRating: [
        { qualityRating: 0, ratingYear: 2025 },
        { qualityRating: 2, ratingYear: 2024 },
        { qualityRating: 1, ratingYear: 2023 },
      ],
    };
    const s = normalizeDetail(d);
    expect(s.classification).toBe('bra');
    expect(s.classificationSeason).toBe(2024);
  });

  it('okända värden ger "okänt"/null, aldrig krasch', () => {
    const s = normalizeDetail({ nutsCode: 'X' });
    expect(s.latestSample).toBeNull();
    expect(s.algae.status).toBe('okänt');
    expect(s.waterTemperatureC).toBeNull();
    expect(statusLevel(s)).toBe('unknown');
  });

  it('algblomning utan avrådan ger nivån "warn"', () => {
    const s = normalizeDetail({ nutsCode: 'X', testResult: [{ sampleDate: Date.UTC(2026, 6, 1), sampleValue: 1, algalValue: 3 }] });
    expect(s.algae).toEqual({ status: 'blomning', observed: '2026-07-01' });
    expect(statusLevel(s)).toBe('warn');
  });
});
