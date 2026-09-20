/**
 * Badvattenstatus — det normaliserade objektet som /api/bad/status levererar (kravspec §6.3)
 * och som klienten renderar. Delas av edge-funktionen och klienten så att modellen är en.
 */

export type Classification = 'utmärkt' | 'bra' | 'tillfredsställande' | 'dålig' | 'ej klassificerat';
export type SampleResult = 'tjänligt' | 'tjänligt med anmärkning' | 'otjänligt';
export type AlgaeStatus = 'ingen' | 'blomning' | 'okänt';

export interface BadStatus {
  havId: string;
  name: string | null;
  classification: Classification;
  classificationSeason: number | null;
  latestSample: { date: string; result: SampleResult | null; ecoli: number | null; entero: number | null } | null;
  algae: { status: AlgaeStatus; observed: string | null };
  /** DK-07: kan aldrig döljas i klienten. */
  advisory: { type: 'otjänligt' | 'alger' | 'annat'; text: string; since: string | null } | null;
  waterTemperatureC: number | null;
  waterTemperatureAt: string | null;
}

export interface BadStatusResponse {
  fetchedAt: string;
  stale: boolean;
  source: string;
  sites: BadStatus[];
  failed: string[];
}

/** Sammanfattande nivå för färg + ikon + text i UI (UX-06). Avrådan väger tyngst (DK-07). */
export type StatusLevel = 'ok' | 'warn' | 'bad' | 'unknown';

export function statusLevel(s: BadStatus | undefined): StatusLevel {
  if (!s) return 'unknown';
  if (s.advisory) return 'bad';
  const r = s.latestSample?.result;
  if (r === 'otjänligt') return 'bad';
  if (r === 'tjänligt med anmärkning' || s.algae.status === 'blomning') return 'warn';
  if (r === 'tjänligt') return 'ok';
  return 'unknown';
}

/** DK-04: ålder i timmar; > 7 dygn räknas som inaktuellt. */
export const STALE_AFTER_HOURS = 24 * 7;

export function ageHours(iso: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
}
