/// <reference types="vite/client" />

/** Datum (ISO) för kartutsnittet enligt data/derived/manifest.json — sätts av vite.config.ts (define). */
declare const __DATA_GENERATED__: string;

/** Ortnamnsindexets hämtdatum och antal namn — sätts av vite.config.ts (define). */
declare const __ORTNAMN_FACTS__: { date: string; count: string };

/** Kommungränsens hämtdatum ur data/derived/kommungrans.geojson — sätts av vite.config.ts (define). */
declare const __KOMMUN_RETRIEVED__: string;
