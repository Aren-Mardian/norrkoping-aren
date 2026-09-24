/**
 * Sidornas identiteter och adresser — avsiktligt skilt från innehållet.
 *
 * `ui/sidor.ts` ligger i landningsvyns kritiska väg och behöver bara veta *vilka* sidor som
 * finns, inte vad de innehåller. Skulle den importera `innehall.ts` hade alla texter och
 * tabeller följt med in i huvudchunken (NFK-02, TK-05). Den här filen kostar några rader.
 */

export type SidaId = 'om' | 'kallor' | 'integritet';

const IDS: ReadonlySet<string> = new Set(['om', 'kallor', 'integritet']);

/** Adressen `#om`, `#kallor` eller `#integritet` — delbar och möjlig att öppna direkt. */
export function sidaFromHash(hash: string): SidaId | null {
  const id = hash.replace(/^#/, '');
  return IDS.has(id) ? (id as SidaId) : null;
}
