#!/usr/bin/env node
/**
 * NFK-02 — Bundlebudget. Hård gräns som bryter bygget.
 * TK-05 — Bundle-isolering: ingen Origo-kod får ingå i landningsvyns kritiska väg.
 *
 * Läser de byggda sidorna, plockar ut det som laddas i den kritiska vägen (module-script,
 * modulepreload, stylesheet, preload av script) och mäter gzip-storlek.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(process.cwd(), 'dist', 'projekt', 'norrkoping');
const BASE = '/projekt/norrkoping/';
/** Måste följa ORIGO_VERSION i src/origo/origoConfig.ts. */
const ORIGO_VERSION = '2.10.0';

/** Budget i byte (gzip). Kravspec §8.1, NFK-02. */
const BUDGET = {
  criticalJs: 180 * 1024,
  criticalCss: 25 * 1024,
  firstViewTotal: 350 * 1024,
  origoChunk: 900 * 1024,
};

const kb = (b) => `${(b / 1024).toFixed(1)} kB`;
let failed = false;

function check(label, actual, limit) {
  const ok = actual <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(40)} ${kb(actual).padStart(10)} / ${kb(limit)}`);
}

/** Löser en URL i HTML:en till en fil i dist och returnerar gzip-storleken. */
function gzipBytes(url, pageDir) {
  let rel;
  if (url.startsWith(BASE)) rel = url.slice(BASE.length);
  else if (url.startsWith('/')) rel = url.slice(1);
  else rel = join(pageDir, url); // relativ till sidan
  const file = join(DIST, rel);
  statSync(file);
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

function analyse(pageRel, label, { jsBudget, cssBudget, totalBudget, forbidOrigo }) {
  const pageDir = pageRel === '' ? '' : pageRel;
  const html = readFileSync(join(DIST, pageRel, 'index.html'), 'utf8');
  const attr = (re) => [...html.matchAll(re)].map((m) => m[1]);
  const scripts = attr(/<script[^>]+type="module"[^>]+src="([^"]+)"/g);
  const preloads = attr(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
  const scriptPreloads = attr(/<link[^>]+rel="preload"[^>]+href="([^"]+\.js)"/g);
  const styles = attr(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);

  const jsFiles = [...new Set([...scripts, ...preloads, ...scriptPreloads])];
  console.log(`\n${label} — kritisk väg (gzip):`);
  let js = 0;
  for (const f of jsFiles) {
    const size = gzipBytes(f, pageDir);
    js += size;
    console.log(`  js   ${f.padEnd(60)} ${kb(size).padStart(10)}`);
  }
  let css = 0;
  for (const f of styles) {
    const size = gzipBytes(f, pageDir);
    css += size;
    console.log(`  css  ${f.padEnd(60)} ${kb(size).padStart(10)}`);
  }
  const htmlSize = gzipSync(Buffer.from(html), { level: 9 }).length;
  console.log();
  if (jsBudget) check(`Kritisk JS (NFK-02) — ${label}`, js, jsBudget);
  if (cssBudget) check(`Kritisk CSS (NFK-02) — ${label}`, css, cssBudget);
  if (totalBudget) check(`Total (NFK-02) — ${label}`, js + css + htmlSize, totalBudget);

  if (forbidOrigo) {
    const hits = jsFiles.filter((f) => /origo/i.test(f) || /vendor\//.test(f));
    const inlineHits = /origo\.min\.js|vendor\/origo/i.test(html);
    if (hits.length > 0 || inlineHits) {
      failed = true;
      console.log(`FAIL Origo-kod i kritisk väg (TK-05): ${[...hits, inlineHits ? 'index.html refererar origo' : ''].filter(Boolean).join(', ')}`);
    } else {
      console.log('OK   Ingen Origo-kod i kritisk väg (TK-05)');
    }
  }
}

analyse('', 'Landningsvy', {
  jsBudget: BUDGET.criticalJs,
  cssBudget: BUDGET.criticalCss,
  totalBudget: BUDGET.firstViewTotal,
  forbidOrigo: true,
});
/**
 * Origo har ingen egen sida längre (ADR-15) — den laddas som en lazy chunk i samma karta.
 * Budgeten gäller därför det som hämtas *när verktygen öppnas*: Origos bundle plus vår
 * verktygsmodul. Att den inte ligger i kritiska vägen bevakas av forbidOrigo ovan.
 */
function analyseToolsChunk() {
  const vendor = join('vendor', `origo-${ORIGO_VERSION}`, 'js', 'origo.min.js');
  const chunk = readdirSync(join(DIST, 'assets')).filter((f) => /^tools-.*\.js$/.test(f));
  console.log(`
Verktygsläget (hämtas först vid klick) — gzip:`);
  let total = gzipBytes(`${BASE}${vendor.split(sep).join('/')}`, '');
  console.log(`  js   ${vendor.split(sep).join('/').padEnd(60)} ${kb(total).padStart(10)}`);
  for (const f of chunk) {
    const size = gzipBytes(`${BASE}assets/${f}`, '');
    total += size;
    console.log(`  js   ${`assets/${f}`.padEnd(60)} ${kb(size).padStart(10)}`);
  }
  console.log();
  check('Verktygschunk (NFK-02)', total, BUDGET.origoChunk);
}

analyseToolsChunk();

if (failed) {
  console.error('\nBundlebudget överskriden — bygget underkänns (NFK-02).');
  process.exit(1);
}
