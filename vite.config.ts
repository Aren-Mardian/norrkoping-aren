import { defineConfig } from 'vite';

/**
 * Sajten lever under en underkatalog på arenm.se (kravspec §3.1, §9.1).
 * Samma värde används av edge-funktionerna (netlify/functions) för API-sökvägar,
 * så att hela appen — inklusive /api — kan proxas som ett block från arenm.se.
 */
export const BASE = '/projekt/norrkoping/';

export default defineConfig({
  base: BASE,
  build: {
    // Bygg rakt in i den sökväg som Netlify publicerar, så att `dist/` kan
    // publiceras som den är och sajten hamnar under /projekt/norrkoping/.
    outDir: `dist${BASE}`,
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    // Bara moderna webbläsare stöds; polyfillen för modulepreload är dött vikt.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Kartkärnan i egna chunkar: byts sällan → cachas länge (NFK-04).
        manualChunks(id) {
          if (id.includes('node_modules/ol/')) return 'ol';
          if (id.includes('node_modules/proj4')) return 'proj4';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
