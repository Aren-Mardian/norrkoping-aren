/**
 * Badplatser (Kärnfunktion B): statisk grunddata (data/bad/badplatser.geojson, DK-06) slås ihop
 * med dynamisk status från /api/bad/status (IK-02). Statusen bär alltid sin ålder (DK-04) och
 * avrådan kan aldrig filtreras bort (DK-07) — filtren nedan rör bara vilka som *dessutom* visas.
 */
import { type BadStatus, type BadStatusResponse, type StatusLevel, ageHours, statusLevel } from '../../shared/bad/status.ts';
import { BADPLATSER_URL, BAD_STATUS_URL } from '../config/site.ts';
import { fetchJson } from '../net/fetchJson.ts';

export type WaterType = 'hav' | 'sjö' | 'å';

export interface BadplatsProps {
  slug: string;
  name: { sv: string; en: string };
  fullName: string;
  waterBody: string | null;
  havId: string;
  type: WaterType;
  isTop3: boolean;
  top3Rank?: number;
  top3Rationale?: { sv: string; en: string };
  top3Score: number;
  hasDissuasion: boolean;
  facilities: Record<string, boolean | null>;
  accessibility: { wheelchair: string; accessibleParking: boolean | null };
  contact: { url: string | null; phone: string | null };
  provenance: { geometrySource: string; positionAccuracyM: number; updated: string; reviewDue: string };
}

export interface Badplats {
  id: string;
  lonLat: [number, number];
  props: BadplatsProps;
  status?: BadStatus;
  level: StatusLevel;
}

export interface BadData {
  sites: Badplats[];
  status: { fetchedAt: string; ageHours: number; stale: boolean; source: string } | null;
  attribution: string;
}

interface Collection {
  attribution: string;
  features: Array<{ id: string; geometry: { coordinates: [number, number] }; properties: BadplatsProps }>;
}

export type Filter = 'alla' | 'top3' | 'hav' | 'sjö';

/** FV-02: badsäsong maj–september; kan överstyras med ?season=1|0 för demo. */
export function isBathingSeason(now: Date = new Date(), search: string = window.location.search): boolean {
  const override = new URLSearchParams(search).get('season');
  if (override === '1') return true;
  if (override === '0') return false;
  const m = now.getMonth() + 1;
  return m >= 5 && m <= 9;
}

export async function loadBadplatser(signal?: AbortSignal): Promise<Collection> {
  return fetchJson<Collection>(BADPLATSER_URL, { signal, retries: 1 });
}

export async function loadStatus(signal?: AbortSignal): Promise<BadStatusResponse | null> {
  try {
    return await fetchJson<BadStatusResponse>(BAD_STATUS_URL, { signal });
  } catch {
    return null; // NFK-25: badplatserna visas ändå, utan status
  }
}

export function merge(collection: Collection, status: BadStatusResponse | null): BadData {
  const byId = new Map((status?.sites ?? []).map((s) => [s.havId, s]));
  const sites = collection.features.map((f) => {
    const s = byId.get(f.properties.havId);
    const site: Badplats = { id: f.id, lonLat: f.geometry.coordinates, props: f.properties, level: statusLevel(s) };
    if (s) site.status = s;
    return site;
  });
  return {
    sites,
    status: status
      ? { fetchedAt: status.fetchedAt, ageHours: ageHours(status.fetchedAt), stale: status.stale, source: status.source }
      : null,
    attribution: collection.attribution,
  };
}

/** Filtrerar listan — men en badplats med avrådan följer alltid med (DK-07, TK-04). */
export function applyFilter(sites: readonly Badplats[], filter: Filter): Badplats[] {
  return sites.filter((s) => {
    if (s.status?.advisory) return true;
    switch (filter) {
      case 'top3':
        return s.props.isTop3;
      case 'hav':
        return s.props.type === 'hav';
      case 'sjö':
        return s.props.type !== 'hav';
      default:
        return true;
    }
  });
}

/** Sortering i listan: Topp 3 först (i rangordning), sedan avrådan/varningar synliga, sedan namn. */
export function sortSites(sites: readonly Badplats[]): Badplats[] {
  const levelRank: Record<StatusLevel, number> = { bad: 0, warn: 1, ok: 2, unknown: 3 };
  return [...sites].sort((a, b) => {
    const ta = a.props.isTop3 ? (a.props.top3Rank ?? 9) : 99;
    const tb = b.props.isTop3 ? (b.props.top3Rank ?? 9) : 99;
    if (ta !== tb) return ta - tb;
    if (levelRank[a.level] !== levelRank[b.level]) return levelRank[a.level] - levelRank[b.level];
    return a.props.fullName.localeCompare(b.props.fullName, 'sv');
  });
}
