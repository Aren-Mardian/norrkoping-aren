import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * Sajten lever under en underkatalog på arenm.se (kravspec §3.1, §9.1).
 * Samma värde används av edge-funktionerna (netlify/functions) för API-sökvägar,
 * så att hela appen — inklusive /api — kan proxas som ett block från arenm.se.
 */
export const BASE = '/projekt/norrkoping/';

/**
 * Härledda geodatafiler ligger här — skapade av tools/, kopieras in i bygget under /data/.
 * Små filer (GeoJSON) är incheckade; stora (PMTiles) är git-ignorerade och hämtas av
 * scripts/fetch-tiles.mjs vid bygge (ADR-10).
 */
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const DERIVED_DIR = resolve(ROOT, 'data/derived');
const DATA_PREFIX = `${BASE}data/`;
const SERVED = /^[\w.-]+\.(pmtiles|geojson|json)$/;
const CONTENT_TYPES: Record<string, string> = {
  pmtiles: 'application/octet-stream',
  geojson: 'application/geo+json; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

/**
 * Serverar data/derived/* under /projekt/norrkoping/data/ i dev-servern med stöd för HTTP Range
 * (PMTiles läser filen i små bitar), och kopierar filerna till dist/ vid bygge.
 * I produktion serverar CDN:et dem som vanliga statiska filer (ADR-06).
 */
function derivedData(): Plugin {
  let outDir = '';
  return {
    name: 'norrkoping-derived-data',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith(DATA_PREFIX)) return next();
        const name = basename(url);
        if (!SERVED.test(name)) return next();
        const file = join(DERIVED_DIR, name);
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const size = statSync(file).size;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', CONTENT_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');

        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
        let start = 0;
        let end = size - 1;
        if (range) {
          start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : end;
          if (start > end || start >= size) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${size}`);
            res.end();
            return;
          }
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        }
        res.setHeader('Content-Length', String(end - start + 1));
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(file, { start, end }).pipe(res);
      });
    },
    closeBundle() {
      if (!existsSync(DERIVED_DIR)) return;
      const target = join(outDir, 'data');
      for (const name of readdirSync(DERIVED_DIR).filter((n) => SERVED.test(n) && n !== 'manifest.json')) {
        mkdirSync(target, { recursive: true });
        const src = join(DERIVED_DIR, name);
        const dst = join(target, name);
        // Hoppa över kopiering om filen redan ligger där oförändrad (PMTiles-filen är stor).
        if (existsSync(dst) && statSync(dst).size === statSync(src).size && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
        copyFileSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [derivedData()],
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
      // Två sidor: landningsvyn och verktygsläget. Origo laddas bara av den senare (TK-05, ADR-02).
      input: {
        main: resolve(ROOT, 'index.html'),
        verktyg: resolve(ROOT, 'verktyg/index.html'),
      },
      output: {
        // Kartkärnan i egna chunkar: byts sällan → cachas länge (NFK-04).
        manualChunks(id) {
          if (id.includes('node_modules/ol/')) return 'ol';
          if (id.includes('node_modules/proj4')) return 'proj4';
          if (id.includes('node_modules/pmtiles') || id.includes('node_modules/fflate')) return 'pmtiles';
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
