#!/usr/bin/env node
/**
 * Bygger Origo (origo-map/origo, BSD 2-clause) från en taggad version och vendorerar de filer
 * verktygsläget behöver till public/vendor/origo-<version>/ (ADR-11).
 *
 * Origo finns inte på npm och GitHub-releaserna innehåller bara källkod, så bygget görs här en
 * gång, reproducerbart, och resultatet checkas in (~2,7 MB). Webbappen laddar det lazy på
 * /verktyg — aldrig på landningsvyn (TK-05).
 *
 *   node tools/build-origo.mjs            # bygger ORIGO_VERSION nedan
 *   node tools/build-origo.mjs v2.11.0    # annan tagg
 *
 * Kräver git, node ≥ 22 och npm. Tar ~1–2 minuter.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGO_VERSION = process.argv[2] ?? 'v2.10.0';
const REPO = 'https://github.com/origo-map/origo.git';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_DIR = `origo-${ORIGO_VERSION.replace(/^v/, '')}`;
const TARGET = join(ROOT, 'public', 'vendor', VERSION_DIR);
/** Origo refererar vissa bilder sidrelativt ("img/…") — de måste ligga under verktygssidans URL. */
const PAGE_DIR = join(ROOT, 'public', 'verktyg');

/** Exakt de filer bundlen refererar (grep "img/|css/" i origo.min.js) plus sprites enligt svgSprites. */
const FILES = [
  ['build/js/origo.min.js', 'js/origo.min.js'],
  ['build/css/style.css', 'css/style.css'],
  ['build/css/svg/fa-icons.svg', 'css/svg/fa-icons.svg'],
  ['build/css/svg/material-icons.svg', 'css/svg/material-icons.svg'],
  ['build/css/svg/miscellaneous.svg', 'css/svg/miscellaneous.svg'],
  ['build/css/svg/origo-icons.svg', 'css/svg/origo-icons.svg'],
  ['build/css/svg/custom.svg', 'css/svg/custom.svg'],
  ['build/css/png/north_arrow_print.png', 'css/png/north_arrow_print.png'],
  ['LICENSE.txt', 'LICENSE.txt'],
];
const PAGE_FILES = [
  ['build/img/geolocation_marker.png', 'img/geolocation_marker.png'],
  ['build/img/geolocation_marker_heading.png', 'img/geolocation_marker_heading.png'],
  ['build/img/loading.gif', 'img/loading.gif'],
  ['build/img/png/drop_blue.png', 'img/png/drop_blue.png'],
  ['build/img/png/farg.png', 'img/png/farg.png'],
];

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

const work = mkdtempSync(join(tmpdir(), 'origo-build-'));
try {
  console.log(`build-origo: klonar ${REPO}@${ORIGO_VERSION} → ${work}`);
  run(`git clone --quiet --depth 1 --branch ${ORIGO_VERSION} ${REPO} src`, work);
  const src = join(work, 'src');
  const commit = execSync('git rev-parse HEAD', { cwd: src }).toString().trim();

  console.log('build-origo: npm ci');
  run('npm ci --no-audit --no-fund --loglevel=error', src);
  console.log('build-origo: npm run build');
  run('npm run build', src);

  if (existsSync(TARGET)) rmSync(TARGET, { recursive: true });
  for (const [from, to] of FILES) {
    const dst = join(TARGET, to);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(join(src, from), dst);
  }
  for (const [from, to] of PAGE_FILES) {
    const dst = join(PAGE_DIR, to);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(join(src, from), dst);
  }
  const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
  writeFileSync(
    join(TARGET, 'VERSION.json'),
    `${JSON.stringify(
      {
        name: 'origo',
        version: pkg.version,
        tag: ORIGO_VERSION,
        commit,
        repository: REPO,
        license: 'BSD-2-Clause',
        openlayers: pkg.dependencies?.ol,
        built: new Date().toISOString().slice(0, 10),
        builtWith: `node ${process.version}`,
        files: FILES.map(([, to]) => to),
        pageFiles: PAGE_FILES.map(([, to]) => `public/verktyg/${to}`),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`build-origo: klart → ${TARGET} (Origo ${pkg.version}, commit ${commit.slice(0, 7)})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
