/**
 * Ortnamnssökets rangordning och dedupering (FK-32). Indexet hämtas via fetchJson, som mockas
 * här — testet handlar om matchningen, inte om nätverket.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const INDEX = {
  attribution: '© Lantmäteriet',
  types: ['Tätort', 'Bebyggelse', 'Sjö'],
  items: [
    ['Norrköping', 0, 578000, 6497000],
    ['Norrköping', 0, 600000, 6500000], // samma namn och typ på annan plats — ska bara visas en gång
    ['Norr Vibberbo', 1, 560000, 6510000],
    ['Vikbolandet norr', 1, 610000, 6490000],
    ['Bråviken', 2, 583000, 6499000],
    ['Åby', 1, 570000, 6505000],
  ],
};

async function load() {
  vi.doMock('../net/fetchJson.ts', () => ({ fetchJson: vi.fn(async () => structuredClone(INDEX)) }));
  vi.doMock('../config/site.ts', () => ({ ORTNAMN_URL: '/index.json' }));
  return import('./index.ts');
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../net/fetchJson.ts');
  vi.doUnmock('../config/site.ts');
});

describe('sok', () => {
  it('rangordnar prefix före ordbörjan före träff inuti ett ord', async () => {
    const { sok } = await load();
    const hits = await sok('norr');
    expect(hits.map((h) => h.namn)).toEqual(['Norrköping', 'Norr Vibberbo', 'Vikbolandet norr']);
  });

  it('visar samma namn och typ bara en gång', async () => {
    const { sok } = await load();
    const hits = await sok('norrköping');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ namn: 'Norrköping', typ: 'Tätort', e: 578000, n: 6497000 });
  });

  it('bortser från diakriter, så att "bravik" hittar "Bråviken"', async () => {
    const { sok } = await load();
    const hits = await sok('bravik');
    expect(hits[0]?.namn).toBe('Bråviken');
    expect(hits[0]?.typ).toBe('Sjö');
  });

  it('kräver minst två tecken och ger tom lista utan träffar', async () => {
    const { sok } = await load();
    expect(await sok('n')).toEqual([]);
    expect(await sok('  ')).toEqual([]);
    expect(await sok('zzzz')).toEqual([]);
  });

  it('respekterar gränsen för antal träffar', async () => {
    const { sok } = await load();
    expect(await sok('o', 2)).toHaveLength(0); // ett tecken
    const hits = await sok('or', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('hämtar indexet en gång även vid upprepade sökningar', async () => {
    const { sok } = await load();
    const { fetchJson } = await import('../net/fetchJson.ts');
    await sok('norr');
    await sok('åby');
    expect(vi.mocked(fetchJson)).toHaveBeenCalledTimes(1);
  });
});
