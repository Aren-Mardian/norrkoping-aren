#!/usr/bin/env node
/**
 * NFK-02 — Bundlebudget. Hård gräns som bryter bygget.
 * TK-05 — Bundle-isolering: ingen Origo-modul får ingå i landningsvyns kritiska väg.
 *
 * Läser dist/projekt/norrkoping/index.html, plockar ut det som laddas i den
 * kritiska vägen (module-script, modulepreload, stylesheet) och mäter gzip-storlek.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(process.cwd(), 'dist', 'projekt', 'norrkoping');
const BASE = '/projekt/norrkoping/';

/** Budget i byte (gzip). Kravspec §8.1, NFK-02. */
const BUDGET = {
  criticalJs: 180 * 1024,
  criticalCss: 25 * 1024,
  firstViewTotal: 350 * 1024,
};

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

const attr = (tag, re) => [...html.matchAll(re)].map((m) => m[1]);
const scripts = attr('script', /<script[^>]+type="module"[^>]+src="([^"]+)"/g);
const preloads = attr('link', /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
const styles = attr('link', /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);

function gzipBytes(url) {
  const rel = url.startsWith(BASE) ? url.slice(BASE.length) : url.replace(/^\//, '');
  const file = join(DIST, rel);
  statSync(file);
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

const kb = (b) => `${(b / 1024).toFixed(1)} kB`;

let failed = false;
function check(label, actual, limit) {
  const ok = actual <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(34)} ${kb(actual).padStart(10)} / ${kb(limit)}`);
}

const jsFiles = [...new Set([...scripts, ...preloads])];
const js = jsFiles.reduce((sum, f) => sum + gzipBytes(f), 0);
const css = styles.reduce((sum, f) => sum + gzipBytes(f), 0);
const htmlSize = gzipSync(Buffer.from(html), { level: 9 }).length;

console.log('Kritisk väg (gzip):');
for (const f of jsFiles) console.log(`  js   ${f.padEnd(60)} ${kb(gzipBytes(f)).padStart(10)}`);
for (const f of styles) console.log(`  css  ${f.padEnd(60)} ${kb(gzipBytes(f)).padStart(10)}`);
console.log();
check('Kritisk JS (NFK-02)', js, BUDGET.criticalJs);
check('Kritisk CSS (NFK-02)', css, BUDGET.criticalCss);
check('Total första vy exkl. tiles (NFK-02)', js + css + htmlSize, BUDGET.firstViewTotal);

// TK-05: Origo får inte finnas i entry-chunken eller dess preloads.
const origoInCritical = jsFiles.filter((f) => /origo/i.test(f) || /origo/i.test(readFileSync(join(DIST, f.slice(BASE.length)), 'utf8').slice(0, 2000)));
if (origoInCritical.length > 0) {
  failed = true;
  console.log(`FAIL Origo-kod i kritisk väg (TK-05): ${origoInCritical.join(', ')}`);
} else {
  console.log('OK   Ingen Origo-kod i kritisk väg (TK-05)');
}

if (failed) {
  console.error('\nBundlebudget överskriden — bygget underkänns (NFK-02).');
  process.exit(1);
}
