import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { renderHeaders, renderRedirects } from './netlify/rules.ts';
import { devFunctions } from './vite/devFunctions.ts';

/**
 * Sajten lever under en underkatalog på arenm.se (kravspec §3.1, §9.1).
 * Samma värde används av edge-funktionerna (netlify/functions) för API-sökvägar,
 * så att hela appen — inklusive /api — kan proxas som ett block från arenm.se.
 */
export const BASE = '/projekt/norrkoping/';

/**
 * Geodata under data/ (kuraterade filer i data/bad, data/poi …; härledda i data/derived) serveras
 * under /projekt/norrkoping/data/<samma sökväg> och kopieras in i bygget. Små filer (GeoJSON) är
 * incheckade; stora (PMTiles) är git-ignorerade och hämtas av scripts/fetch-tiles.mjs vid bygge
 * (ADR-10). data/raw/ (råuttag) och dokumentation följer aldrig med.
 */
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const DATA_DIR = resolve(ROOT, 'data');
const DATA_PREFIX = `${BASE}data/`;
const SERVED = /^(?!raw\/)(?:[\w-]+\/)*[\w.-]+\.(pmtiles|geojson|json)$/;
// derived/ortnamn.geojson (1,3 MB) är råvara för tools/ortnamn_index.py, inte något klienten
// behöver — sökindexet i data/sok/ortnamn.json är det som levereras.
const EXCLUDED = new Set(['derived/manifest.json', 'derived/ortnamn.geojson']);
const CONTENT_TYPES: Record<string, string> = {
  pmtiles: 'application/octet-stream',
  geojson: 'application/geo+json; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

/** Kommungränsens hämtdatum, ur filens egen proveniens. */
function kommunRetrieved(): string {
  try {
    const gj = JSON.parse(readFileSync(join(DATA_DIR, 'derived', 'kommungrans.geojson'), 'utf8')) as {
      features?: Array<{ properties?: { retrieved?: string } }>;
    };
    return gj.features?.[0]?.properties?.retrieved ?? '';
  } catch {
    return '';
  }
}

/** Ortnamnsindexets datum och antal namn — visas i sidfotens källförteckning (JK-01). */
function ortnamnFacts(): { date: string; count: string } {
  try {
    const index = JSON.parse(readFileSync(join(DATA_DIR, 'sok', 'ortnamn.json'), 'utf8')) as { retrieved?: string; items?: unknown[] };
    // Formatera här, inte i varje text som använder siffran: sidfoten och källsidan
    // ska säga "7 865", inte "7865".
    return { date: index.retrieved ?? '', count: (index.items?.length ?? 0).toLocaleString('sv-SE') };
  } catch {
    return { date: '', count: '' };
  }
}

/** Kartutsnittets datum och storlek (ADR-10-manifestet) — visas i sidfotens källförteckning. */
function topoFacts(): { date: string; size: string } {
  try {
    const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'derived', 'manifest.json'), 'utf8')) as {
      files?: Array<{ generated?: string; bytes?: number }>;
    };
    const file = manifest.files?.[0];
    const mb = file?.bytes ? Math.round(file.bytes / 1024 / 1024) : 0;
    return { date: file?.generated ?? '', size: mb ? `${mb} MB` : '' };
  } catch {
    return { date: '', size: '' };
  }
}

function listDataFiles(dir = DATA_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listDataFiles(full));
    else {
      const rel = relative(DATA_DIR, full).split(sep).join('/');
      if (SERVED.test(rel) && !EXCLUDED.has(rel)) out.push(rel);
    }
  }
  return out;
}

/**
 * Serverar data/** under /projekt/norrkoping/data/ i dev-servern med stöd för HTTP Range
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
        const rel = decodeURIComponent(url.slice(DATA_PREFIX.length));
        if (!SERVED.test(rel) || EXCLUDED.has(rel)) return next();
        const file = join(DATA_DIR, rel);
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const size = statSync(file).size;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', CONTENT_TYPES[rel.split('.').pop() ?? ''] ?? 'application/octet-stream');
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
      if (!existsSync(DATA_DIR)) return;
      for (const rel of listDataFiles()) {
        const src = join(DATA_DIR, rel);
        const dst = join(outDir, 'data', rel);
        mkdirSync(join(dst, '..'), { recursive: true });
        // Hoppa över kopiering om filen redan ligger där oförändrad (PMTiles-filen är stor).
        if (existsSync(dst) && statSync(dst).size === statSync(src).size && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
        copyFileSync(src, dst);
      }
    },
  };
}

/**
 * CSP per sida (NFK-16). Netlify tillåter inte olika headervärden per sökväg på ett förutsägbart
 * sätt (den generella regeln vinner), så policyn injiceras som <meta http-equiv> i varje byggd
 * HTML-sida. Bara vid bygge: i dev injicerar Vite egna <style>-element för HMR som annars blockeras.
 * frame-ancestors kan inte uttryckas i meta och sätts som header i netlify.toml.
 */
const CSP_STRICT =
  "default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; script-src 'self'; style-src 'self'; " +
  "font-src 'self'; manifest-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; " +
  "form-action 'self'; upgrade-insecure-requests";
/** Origo-sidan (ADR-11): Origo bygger paneler med style-attribut och sätter <base>. script-src förblir strikt. */
const CSP_TOOLS = CSP_STRICT.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'").replace("base-uri 'none'", "base-uri 'self'");

/**
 * Skriver `_redirects` och `_headers` i publiceringsroten (ADR-17). Reglerna följer därmed med
 * som vanliga filer i deployen i stället för att läsas ur byggkonfigurationen — vilket visade
 * sig kunna bli gammal utan att något märktes.
 */
function netlifyRules(): Plugin {
  return {
    name: 'norrkoping-netlify-rules',
    apply: 'build',
    closeBundle() {
      // outDir är dist/<BASE>; filerna ska ligga i publiceringsroten, alltså dist/.
      const publishRoot = resolve(ROOT, 'dist');
      mkdirSync(publishRoot, { recursive: true });
      writeFileSync(join(publishRoot, '_redirects'), renderRedirects(), 'utf8');
      writeFileSync(join(publishRoot, '_headers'), renderHeaders(), 'utf8');
    },
  };
}

function cspMeta(): Plugin {
  return {
    name: 'norrkoping-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      // Sidan kan ladda in Origo, som bygger paneler med style-attribut och sätter <base>.
      // Policyn måste därför tillåta det redan från start (ADR-15).
      const content = CSP_TOOLS;
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [derivedData(), cspMeta(), netlifyRules(), devFunctions({ root: ROOT, apiPrefix: `${BASE}api/` })],
  define: {
    __TOPO_FACTS__: JSON.stringify(topoFacts()),
    __ORTNAMN_FACTS__: JSON.stringify(ortnamnFacts()),
    __KOMMUN_RETRIEVED__: JSON.stringify(kommunRetrieved()),
  },
  build: {
    // Bygg rakt in i den sökväg som Netlify publicerar, så att `dist/` kan
    // publiceras som den är och sajten hamnar under /projekt/norrkoping/.
    outDir: `dist${BASE}`,
    emptyOutDir: true,
    target: 'es2022',
    // Inga källkartor i publiceringen. `dist/` laddas upp som den är, så source maps hade
    // legat publikt hämtbara — ol.js.map ensam är 2,1 MB, totalt 2,9 MB per deploy.
    // Behövs de vid felsökning: `npm run build -- --sourcemap` (flaggan slår över det här).
    sourcemap: false,
    // Bara moderna webbläsare stöds; polyfillen för modulepreload är dött vikt.
    modulePreload: { polyfill: false },
    rollupOptions: {
      // En sida. Origo lever i en egen chunk som hämtas först när verktygen öppnas (ADR-15).
      input: { main: resolve(ROOT, 'index.html') },
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
