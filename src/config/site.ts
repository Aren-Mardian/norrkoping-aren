/**
 * Klientkonfiguration. Allt här är publikt — inga hemligheter (A2, NFK-15).
 */

/** Sajtens bassökväg, t.ex. "/projekt/norrkoping/". Sätts av Vite från vite.config.ts. */
export const BASE = import.meta.env.BASE_URL;

/** Edge-funktionerna ligger under samma bas så att hela appen kan proxas som ett block. */
export const API_BASE = `${BASE}api`;

/**
 * FK-33: utan `.env` (eller med tom VITE_LM_ENABLED) körs appen i fallback-läge
 * med OpenStreetMap-bakgrund och en synlig utvecklingsbanner.
 */
export const LM_ENABLED = import.meta.env.VITE_LM_ENABLED === 'true';

export const IS_DEV = import.meta.env.DEV;

/**
 * Edge-funktionerna (/api/*) finns i alla byggda miljöer (Netlify prod/preview) och under
 * `npm run dev:netlify`. Bara ren `npm run dev` saknar dem.
 */
export const PROXY_AVAILABLE = !IS_DEV || LM_ENABLED;

/** Självhostad bakgrundskarta (PMTiles, ADR-09); serveras av Vite-pluginen lokalt och som statisk fil i produktion. */
export const TOPO_PMTILES_URL = `${BASE}data/derived/topowebb-farg.pmtiles`;

/** Kommungräns (GeoJSON, EPSG:4326). */
export const KOMMUNGRANS_URL = `${BASE}data/derived/kommungrans.geojson`;

/** Badplatser, statisk grunddata (kravspec §6.3). */
export const BADPLATSER_URL = `${BASE}data/bad/badplatser.geojson`;

/** Dynamisk badvattenstatus (IK-02) och väder (IK-03). */
export const BAD_STATUS_URL = `${API_BASE}/bad/status`;
export const VADER_URL = `${API_BASE}/vader`;

/** Markhöjd via Lantmäteriets Markhöjd Direkt (IK-08) — en punkt per anrop (ADR-16). */
export const HOJD_URL = `${API_BASE}/hojd`;

/** Ortnamnsindex för sök (FK-32), härlett av tools/ortnamn_index.py. Laddas först vid sökning. */
export const ORTNAMN_URL = `${BASE}data/sok/ortnamn.json`;
