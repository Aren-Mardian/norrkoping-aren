/**
 * IK-08 — höjdproxyns spärrar och normalisering. Samma krav som tile-proxyn: inget utanför
 * kommunen, inga obegränsade batchar, och Lantmäteriets nodata (-9999) får aldrig nå klienten
 * som en höjd.
 */
import { describe, expect, it } from 'vitest';
import { KOMMUN_BBOX_3006 } from '../../shared/geo/kommun.ts';
import { MAX_POINTS, NODATA, buildUpstreamBody, buildUpstreamUrl, normalizeHojd, parseBody, parseQueryPoint } from './hojd.ts';

// Norrköpings centrum respektive en punkt i Göteborgstrakten.
const INNE: [number, number] = [578000, 6497000];
const UTE: [number, number] = [319000, 6398000];

describe('parseQueryPoint', () => {
  it('accepterar en punkt inom kommunen', () => {
    const r = parseQueryPoint(new URLSearchParams({ e: String(INNE[0]), n: String(INNE[1]) }));
    expect(r).toEqual({ ok: true, points: [INNE] });
  });

  it('avvisar punkter utanför panoreringsspärren', () => {
    const r = parseQueryPoint(new URLSearchParams({ e: String(UTE[0]), n: String(UTE[1]) }));
    expect(r.ok).toBe(false);
  });

  it('avvisar saknade och ogiltiga tal', () => {
    expect(parseQueryPoint(new URLSearchParams({ e: '578000' })).ok).toBe(false);
    expect(parseQueryPoint(new URLSearchParams({ e: 'abc', n: '6497000' })).ok).toBe(false);
    expect(parseQueryPoint(new URLSearchParams({ e: 'NaN', n: 'Infinity' })).ok).toBe(false);
  });

  it('täcker hela kommunens bbox', () => {
    const [minE, minN, maxE, maxN] = KOMMUN_BBOX_3006;
    for (const p of [[minE, minN], [maxE, maxN], [minE, maxN]] as Array<[number, number]>) {
      expect(parseQueryPoint(new URLSearchParams({ e: String(p[0]), n: String(p[1]) })).ok).toBe(true);
    }
  });
});

describe('parseBody', () => {
  it('accepterar en lista med punkter', () => {
    const r = parseBody({ points: [INNE, [579000, 6498000]] });
    expect(r).toEqual({ ok: true, points: [INNE, [579000, 6498000]] });
  });

  it('avvisar tom lista, fel form och för många punkter', () => {
    expect(parseBody({ points: [] }).ok).toBe(false);
    expect(parseBody({}).ok).toBe(false);
    expect(parseBody({ points: [[1]] }).ok).toBe(false);
    expect(parseBody({ points: 'nej' }).ok).toBe(false);
    expect(parseBody({ points: Array.from({ length: MAX_POINTS + 1 }, () => INNE) }).ok).toBe(false);
  });

  it('avvisar hela anropet om någon punkt ligger utanför kommunen (NFK-18)', () => {
    const r = parseBody({ points: [INNE, UTE] });
    expect(r.ok).toBe(false);
  });
});

describe('normalizeHojd', () => {
  it('läser en Point och avrundar till centimeter', () => {
    const r = normalizeHojd({ geometry: { type: 'Point', coordinates: [578000, 6497000, 12.74629020690918] } });
    expect(r).toEqual([{ e: 578000, n: 6497000, z: 12.75 }]);
  });

  it('läser en MultiPoint i ordning', () => {
    const r = normalizeHojd({
      geometry: { type: 'MultiPoint', coordinates: [[578000, 6497000, 12.7], [579000, 6498000, 15.3]] },
    });
    expect(r.map((p) => p.z)).toEqual([12.7, 15.3]);
  });

  it('gör nodata till null i stället för -9999', () => {
    const r = normalizeHojd({ geometry: { type: 'MultiPoint', coordinates: [[578000, 6497000, NODATA]] } });
    expect(r[0]?.z).toBeNull();
  });

  it('tål svar utan geometri', () => {
    expect(normalizeHojd({})).toEqual([]);
    expect(normalizeHojd({ geometry: { type: 'MultiPoint', coordinates: [] } })).toEqual([]);
  });
});

describe('uppströmsanrop', () => {
  it('bygger URL med srid och utan dubbla snedstreck', () => {
    expect(buildUpstreamUrl('https://x.se/v1/')).toBe('https://x.se/v1/hojd?srid=3006');
    expect(buildUpstreamUrl('https://x.se/v1')).toBe('https://x.se/v1/hojd?srid=3006');
  });

  it('skickar en GeoJSON MultiPoint — formatet Markhöjd Direkt kräver', () => {
    expect(JSON.parse(buildUpstreamBody([INNE, [579000, 6498000]]))).toEqual({
      type: 'MultiPoint',
      coordinates: [INNE, [579000, 6498000]],
    });
  });
});
