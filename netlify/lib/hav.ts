/**
 * Normalisering av Havs- och vattenmyndighetens Badplatsen-API till kravspecens statusobjekt (§6.3).
 * Ren logik, ingen I/O — testad i hav.test.ts. Kodvärden verifierade mot API:et 2026-09-20:
 *   classification/qualityRating: 1 utmärkt, 2 bra, 3 tillfredsställande, 4 dålig, 0 ej klassificerad, 6 ny badplats
 *   sampleValue:  1 tjänligt, 2 tjänligt med anmärkning, 3 otjänligt, 4 uppgift saknas
 *   algalValue:   3 blomning, 4 ingen blomning, 5 uppgift saknas
 *   dissuasion.type: 1 otjänligt badvattenprov, 2 algblomning
 */
import { type BadStatus, type Classification, type SampleResult, statusLevel } from '../../shared/bad/status.ts';

export type { BadStatus } from '../../shared/bad/status.ts';
export { statusLevel };

export interface HavTestResult {
  sampleDate?: number;
  sampleValue?: number;
  sampleText?: string;
  ecoliValue?: number | null;
  enteroValue?: number | null;
  tempValue?: string | number | null;
  algalValue?: number;
}

export interface HavDissuasion {
  type?: number;
  dissuasionTypeText?: string;
  description?: string;
  startdate?: number;
}

export interface HavDetail {
  nutsCode: string;
  locationName?: string;
  classification?: number;
  classificationYear?: number;
  qualityRating?: Array<{ qualityRating: number; ratingYear: number }>;
  testResult?: HavTestResult[];
  dissuasion?: HavDissuasion[];
  sampleTemperature?: string | number | null;
  sampleDate?: number;
  algalValue?: number;
}

const CLASSIFICATION: Record<number, Classification> = {
  1: 'utmärkt',
  2: 'bra',
  3: 'tillfredsställande',
  4: 'dålig',
};

const SAMPLE: Record<number, SampleResult> = {
  1: 'tjänligt',
  2: 'tjänligt med anmärkning',
  3: 'otjänligt',
};

function isoDate(ms: number | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function temperature(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function normalizeDetail(d: HavDetail): BadStatus {
  const results = [...(d.testResult ?? [])]
    .filter((t) => typeof t.sampleDate === 'number')
    .sort((a, b) => (b.sampleDate ?? 0) - (a.sampleDate ?? 0));
  const latest = results[0];

  // Senaste säsong med riktig klassificering; annars "ej klassificerat".
  const rated = (d.qualityRating ?? []).filter((r) => r.qualityRating in CLASSIFICATION).sort((a, b) => b.ratingYear - a.ratingYear)[0];
  const classification = rated ? CLASSIFICATION[rated.qualityRating]! : 'ej klassificerat';

  const algalValue = latest?.algalValue ?? d.algalValue;
  const algae: BadStatus['algae'] =
    algalValue === 3
      ? { status: 'blomning', observed: isoDate(latest?.sampleDate) }
      : algalValue === 4
        ? { status: 'ingen', observed: null }
        : { status: 'okänt', observed: null };

  const dis = (d.dissuasion ?? [])[0];
  const advisory: BadStatus['advisory'] = dis
    ? {
        type: dis.type === 1 ? 'otjänligt' : dis.type === 2 ? 'alger' : 'annat',
        text: dis.description || dis.dissuasionTypeText || 'Avrådan från bad',
        since: isoDate(dis.startdate),
      }
    : null;

  const tempFromSample = temperature(latest?.tempValue);
  const waterTemperatureC = tempFromSample ?? temperature(d.sampleTemperature);

  return {
    havId: d.nutsCode,
    name: d.locationName ?? null,
    classification,
    classificationSeason: rated?.ratingYear ?? null,
    latestSample: latest
      ? {
          date: isoDate(latest.sampleDate) ?? '',
          result: latest.sampleValue !== undefined ? (SAMPLE[latest.sampleValue] ?? null) : null,
          ecoli: typeof latest.ecoliValue === 'number' ? latest.ecoliValue : null,
          entero: typeof latest.enteroValue === 'number' ? latest.enteroValue : null,
        }
      : null,
    algae,
    advisory,
    waterTemperatureC,
    waterTemperatureAt: waterTemperatureC === null ? null : (isoDate(latest?.sampleDate) ?? isoDate(d.sampleDate)),
  };
}
