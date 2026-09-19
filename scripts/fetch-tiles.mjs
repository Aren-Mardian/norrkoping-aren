#!/usr/bin/env node
/**
 * Hämtar stora härledda geodatafiler (PMTiles) inför bygget enligt data/derived/manifest.json (ADR-10).
 *
 * Filerna är för stora för git (GitHub: 100 MB/fil) och publiceras i stället som release-artefakter
 * på GitHub. Vid bygge (lokalt eller på Netlify) laddas de ned hit, verifieras mot SHA-256 i
 * manifestet och kopieras sedan in i dist/ av Vite-pluginen. Finns filen redan lokalt med rätt
 * hash hoppas nedladdningen över.
 *
 * I CI (Netlify/GitHub Actions) är en saknad fil ett byggfel — en tom bakgrundskarta får inte
 * deployas i tysthet. Lokalt räcker en varning: appen faller tillbaka på OSM (FK-33).
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = join(ROOT, 'data', 'derived');
const MANIFEST = join(DERIVED, 'manifest.json');
const IN_CI = Boolean(process.env.CI || process.env.NETLIFY);

function sha256(file) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolvePromise(hash.digest('hex')))
      .on('error', reject);
  });
}

async function verify(file, entry) {
  if (!existsSync(file)) return false;
  if (statSync(file).size !== entry.bytes) return false;
  return (await sha256(file)) === entry.sha256;
}

/**
 * Release-filer i ett privat GitHub-repo kan inte hämtas anonymt via den vanliga
 * releases/download-länken (404). Finns en token (GitHub Actions: GITHUB_TOKEN; Netlify: en
 * fine-grained PAT med "Contents: read" satt som miljövariabel) slås filen upp via API:et och
 * hämtas med Authorization-header. Utan token används den publika länken — fungerar för publika repon.
 */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const RELEASE_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/;

async function resolveSource(entry) {
  const match = RELEASE_URL.exec(entry.url);
  if (!GITHUB_TOKEN || !match) return { url: entry.url, headers: {} };
  const [, owner, repo, tag, name] = match;
  const api = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(api, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} från GitHub API vid uppslag av release ${tag}`);
  const asset = (await res.json()).assets?.find((a) => a.name === name);
  if (!asset) throw new Error(`Release ${tag} saknar filen ${name}`);
  // API:et svarar med redirect till en signerad URL; Node skickar inte Authorization vidare dit.
  return { url: asset.url, headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/octet-stream' } };
}

async function download(entry, file) {
  const source = await resolveSource(entry);
  const res = await fetch(source.url, { redirect: 'follow', headers: source.headers });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} från ${source.url.split('?')[0]}`);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.part`;
  await pipeline(res.body, createWriteStream(tmp));
  const ok = await verify(tmp, entry);
  if (!ok) {
    unlinkSync(tmp);
    throw new Error(`Nedladdad fil matchar inte manifestets storlek/SHA-256: ${entry.name}`);
  }
  if (existsSync(file)) unlinkSync(file);
  const { renameSync } = await import('node:fs');
  renameSync(tmp, file);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
let failed = false;

for (const entry of manifest.files) {
  const file = join(DERIVED, entry.name);
  const mb = (entry.bytes / 2 ** 20).toFixed(0);
  if (await verify(file, entry)) {
    console.log(`fetch-tiles: ${entry.name} finns redan (${mb} MB, SHA-256 OK)`);
    continue;
  }
  if (!entry.url) {
    console.warn(`fetch-tiles: ${entry.name} saknas och har ingen URL i manifestet — hoppar över`);
    failed = failed || IN_CI;
    continue;
  }
  try {
    const t0 = Date.now();
    console.log(`fetch-tiles: hämtar ${entry.name} (${mb} MB) från ${entry.url}${GITHUB_TOKEN ? ' (autentiserat via GitHub API)' : ''}`);
    await download(entry, file);
    console.log(`fetch-tiles: ${entry.name} klar på ${((Date.now() - t0) / 1000).toFixed(0)} s, SHA-256 OK`);
  } catch (err) {
    console.error(`fetch-tiles: ${entry.name}: ${err.message}`);
    failed = true;
  }
}

if (failed) {
  if (IN_CI) {
    console.error('fetch-tiles: bygget avbryts — bakgrundskartan får inte saknas i en deploy (A5, NFK-25).');
    process.exit(1);
  }
  console.warn('fetch-tiles: fortsätter utan filen; appen visar OSM-fallback lokalt (FK-33).');
}
