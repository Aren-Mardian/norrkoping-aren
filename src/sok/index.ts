/**
 * Ortnamnssök (FK-32) — Lantmäteriets *Ortnamn Nedladdning, vektor* (CC BY 4.0), förberett
 * offline till ett kompakt index (tools/ortnamn_index.py): 8 445 namn inom kommunen med
 * koordinater i EPSG:3006, ~91 kB gzip.
 *
 * Den här modulen laddas **dynamiskt** vid första sökningen (TK-05) — varken den eller
 * indexet ligger i landningsvyns kritiska väg. Matchningen är avsiktligt enkel och
 * allokeringssnål: en genomgång av listan, prefix före ordbörjan före delsträng, och
 * typordningen i indexet avgör vid lika. 8 445 poster tar under en millisekund.
 */
import { ORTNAMN_URL } from '../config/site.ts';
import { fetchJson } from '../net/fetchJson.ts';

/** [namn, typindex, östlig koordinat, nordlig koordinat] — EPSG:3006, heltalsmeter. */
type Row = [string, number, number, number];

interface Index {
  types: string[];
  items: Row[];
  attribution: string;
}

export interface Traff {
  namn: string;
  typ: string;
  /** EPSG:3006. */
  e: number;
  n: number;
}

let cache: Promise<Index> | null = null;

/** Hämtar (och minns) indexet. Anropas första gången användaren skriver i sökfältet. */
export function loadIndex(): Promise<Index> {
  cache ??= fetchJson<Index>(ORTNAMN_URL, { timeoutMs: 12_000, retries: 1 });
  return cache;
}

/** Normaliserar för sökning: gemener och utan diakriter, så att "Bravik" hittar "Bråviken". */
function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * 0 = träff från början, 1 = träff vid ett ordslut, 2 = träff inuti ett ord, -1 = ingen träff.
 * Ger "Norr" ordningen Norrköping → Skärblacka Norrgård → Vikbolandet norr om.
 */
function rank(haystack: string, needle: string): number {
  const at = haystack.indexOf(needle);
  if (at < 0) return -1;
  if (at === 0) return 0;
  return /[\s-]/.test(haystack[at - 1] ?? '') ? 1 : 2;
}

export async function sok(query: string, limit = 8): Promise<Traff[]> {
  const needle = fold(query.trim());
  if (needle.length < 2) return [];
  const index = await loadIndex();

  // Bästa `limit` träffar utan att sortera hela listan: en liten insättningssorterad topplista.
  // Samma namn och typ visas bara en gång — indexet kan innehålla flera positioner för ett
  // objekt som sträcker sig över halva kommunen, och en lista med fem rader "Bråviken" hjälper ingen.
  const best: Array<{ row: Row; score: number }> = [];
  const seen = new Set<string>();
  for (const row of index.items) {
    const r = rank(fold(row[0]), needle);
    if (r < 0) continue;
    const key = `${fold(row[0])}|${row[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Lägre är bättre: träffposition först, därefter indexets typordning (tätort → sankmark).
    const score = r * 100 + row[1];
    if (best.length === limit && score >= (best[best.length - 1]?.score ?? Infinity)) continue;
    let i = best.length;
    while (i > 0 && (best[i - 1]?.score ?? 0) > score) i--;
    best.splice(i, 0, { row, score });
    if (best.length > limit) best.pop();
  }

  return best.map(({ row }) => ({ namn: row[0], typ: index.types[row[1]] ?? '', e: row[2], n: row[3] }));
}

export async function attribution(): Promise<string> {
  return (await loadIndex()).attribution;
}
