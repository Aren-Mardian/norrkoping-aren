/**
 * Normalisering av SMHI:s punktprognos (API "snow1g" v1, som ersatte pmp3g 2026-03-31) till
 * det lilla vädermodulen behöver (FK-18). Ren logik, ingen I/O — testad i smhi.test.ts.
 *
 * Format (verifierat 2026-09-20): { referenceTime, geometry, timeSeries: [{ time, data: {
 *   air_temperature (°C), wind_speed (m/s), wind_speed_of_gust, wind_from_direction (°),
 *   probability_of_precipitation (%), precipitation_amount_mean (mm/h), symbol_code (1–27),
 *   cloud_area_fraction (oktas), thunderstorm_probability (%) … } }] }
 */

export interface SmhiPoint {
  referenceTime?: string;
  createdTime?: string;
  geometry?: { coordinates?: number[] };
  timeSeries?: Array<{ time: string; data: Record<string, number | null | undefined> }>;
}

export interface ForecastHour {
  time: string;
  tempC: number | null;
  windMs: number | null;
  gustMs: number | null;
  windDir: number | null;
  precipMm: number | null;
  precipProb: number | null;
  /** SMHI:s symbolkod 1–27 (samma skala som Wsymb2). */
  symbol: number | null;
  cloudOctas: number | null;
  thunderProb: number | null;
}

export interface Forecast {
  /** Prognosens utgivningstid — visas alltid för användaren (FK-18). */
  referenceTime: string | null;
  /** SMHI:s närmaste rutpunkt, avrundad — inte användarens exakta position (IK-03). */
  point: [number, number] | null;
  hours: ForecastHour[];
}

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Nästa `hoursAhead` timmar från och med nu (eller från första tidpunkten om `now` saknas). */
export function normalizeForecast(raw: SmhiPoint, hoursAhead = 12, now: Date = new Date()): Forecast {
  const series = (raw.timeSeries ?? []).filter((e) => typeof e.time === 'string' && e.data);
  const cutoffStart = now.getTime() - 60 * 60 * 1000; // ta med innevarande timme
  const upcoming = series
    .filter((e) => new Date(e.time).getTime() >= cutoffStart)
    .slice(0, hoursAhead);
  const hours = upcoming.map((e) => ({
    time: e.time,
    tempC: num(e.data['air_temperature']),
    windMs: num(e.data['wind_speed']),
    gustMs: num(e.data['wind_speed_of_gust']),
    windDir: num(e.data['wind_from_direction']),
    precipMm: num(e.data['precipitation_amount_mean']),
    precipProb: num(e.data['probability_of_precipitation']),
    symbol: num(e.data['symbol_code']),
    cloudOctas: num(e.data['cloud_area_fraction']),
    thunderProb: num(e.data['thunderstorm_probability']),
  }));
  const coords = raw.geometry?.coordinates;
  return {
    referenceTime: raw.referenceTime ?? null,
    point: coords && coords.length >= 2 ? [roundCoordinate(coords[0]!), roundCoordinate(coords[1]!)] : null,
    hours,
  };
}

/** Avrundar till 2 decimaler (≈ 1 km) innan koordinaten skickas vidare — cachevänligt och integritetsvänligt (IK-03). */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
