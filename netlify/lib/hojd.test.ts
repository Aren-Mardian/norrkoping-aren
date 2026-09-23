/**
 * IK-08 — höjdproxyns spärrar och normalisering. Punkten måste ligga innanför kommungränsen,
 * inte bara inom dess bbox (ADR-16), och Lantmäteriets nodata (-9999) får aldrig nå klienten
 * som en höjd.
 */
import { describe, expect, it } from 'vitest';
import { KOMMUN_BBOX_3006 } from '../../shared/geo/kommun.ts';
import { pointInKommun } from '../../shared/geo/kommunPolygon.ts';
import { NODATA, buildUpstreamUrl, normalizeHojd, parseQueryPoint } from './hojd.ts';

const query = (e: number, n: number): URLSearchParams => new URLSearchParams({ e: String(e), n: String(n) });

// Norrköpings centrum, respektive en punkt i Göteborgstrakten.
const INNE: [number, number] = [578000, 6497000];
const UTE: [number, number] = [319000, 6398000];

describe('parseQueryPoint', () => {
  it('accepterar en punkt inne i kommunen', () => {
    expect(parseQueryPoint(query(...INNE))).toEqual({ ok: true, points: [INNE] });
  });

  it('avvisar punkter långt utanför', () => {
    expect(parseQueryPoint(query(...UTE)).ok).toBe(false);
  });

  it('avvisar saknade och ogiltiga tal', () => {
    expect(parseQueryPoint(new URLSearchParams({ e: '578000' })).ok).toBe(false);
    expect(parseQueryPoint(query(Number.NaN, 6497000)).ok).toBe(false);
    expect(parseQueryPoint(new URLSearchParams({ e: 'abc', n: '6497000' })).ok).toBe(false);
  });
});

describe('pointInKommun — gränsen, inte bbox:en (ADR-16)', () => {
  it('släpper igenom orter i kommunen', () => {
    // Norrköping, Kolmården, Skärblacka, Krokek — alla innanför gränsen.
    for (const p of [[578000, 6497000], [588000, 6505000], [556000, 6494000], [590000, 6506000]] as Array<[number, number]>) {
      expect(pointInKommun(...p)).toBe(true);
    }
  });

  it('nekar punkter som ligger i bbox:en men i en annan kommun', () => {
    const [minE, minN, maxE, maxN] = KOMMUN_BBOX_3006;
    // Bbox:ens fyra hörn ligger alla utanför kommunen — den är 114 × 49 km.
    for (const p of [[minE, minN], [minE, maxN], [maxE, minN], [maxE, maxN]] as Array<[number, number]>) {
      expect(pointInKommun(...p)).toBe(false);
      expect(parseQueryPoint(query(...p)).ok).toBe(false);
    }
  });

  it('nekar punkter utanför bbox:en utan att gå igenom polygonen', () => {
    expect(pointInKommun(...UTE)).toBe(false);
  });
});

describe('normalizeHojd', () => {
  it('läser en Point och avrundar till centimeter', () => {
    const r = normalizeHojd({ geometry: { type: 'Point', coordinates: [578000, 6497000, 12.74629020690918] } });
    expect(r).toEqual([{ e: 578000, n: 6497000, z: 12.75 }]);
  });

  it('gör nodata till null i stället för -9999', () => {
    const r = normalizeHojd({ geometry: { type: 'Point', coordinates: [578000, 6497000, NODATA] } });
    expect(r[0]?.z).toBeNull();
  });

  it('tål svar utan geometri', () => {
    expect(normalizeHojd({})).toEqual([]);
  });
});

describe('uppströmsanrop', () => {
  it('bygger URL med srid och utan dubbla snedstreck', () => {
    expect(buildUpstreamUrl('https://x.se/v1/')).toBe('https://x.se/v1/hojd?srid=3006');
    expect(buildUpstreamUrl('https://x.se/v1')).toBe('https://x.se/v1/hojd?srid=3006');
  });
});
