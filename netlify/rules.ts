/**
 * Omdirigeringar och HTTP-headers — **enda källan** (ADR-17).
 *
 * De låg tidigare i `netlify.toml`. I drift visade sig Netlify tillämpa en gammal version av
 * den filen: deployen rapporterade 2 redirect- och 3 headerregler (exakt vad repots allra
 * första commit hade) medan repot hade 8 respektive 4, och sajtens kod uppdaterades normalt.
 * Reglerna flyttades därför till `_redirects` och `_headers`, som skrivs in i publiceringsmappen
 * vid bygget och laddas upp som vilka filer som helst — de kan inte bli gamla på vägen.
 *
 * `netlify.toml` behåller bara det som måste läsas innan bygget startar: byggkommando,
 * nodeversion och funktionskatalog.
 */

/** Sajtens bassökväg. Måste följa BASE i vite.config.ts. */
const BASE = '/projekt/norrkoping/';

/**
 * Ordningen är betydelsefull: Netlify tar första regeln som matchar. Sista regeln är därför
 * fångsten som ger 404 för allt okänt — den får inte stå före de specifika.
 */
export const redirects: ReadonlyArray<{ from: string; to: string; status: number }> = [
  // Sajtens rot ligger under BASE (kravspec §9.1). På arenm.se proxas BASE hit.
  { from: '/', to: BASE, status: 301 },

  // Verktygen har ingen egen sida längre (ADR-15) — gamla länkar landar på kartan.
  { from: `${BASE}origo`, to: BASE, status: 301 },
  { from: `${BASE}origo/*`, to: BASE, status: 301 },
  { from: `${BASE}verktyg`, to: BASE, status: 301 },
  { from: `${BASE}verktyg/*`, to: BASE, status: 301 },

  // Saknad datafil eller vendorfil ska ge 404, inte index.html: annars försöker PMTiles-läsaren
  // tolka HTML som kartdata, och en felstavad sökväg ser ut att fungera (ADR-17).
  { from: `${BASE}data/*`, to: `${BASE}404.html`, status: 404 },
  { from: `${BASE}vendor/*`, to: `${BASE}404.html`, status: 404 },
  { from: `${BASE}img/*`, to: `${BASE}404.html`, status: 404 },
  { from: `${BASE}assets/*`, to: `${BASE}404.html`, status: 404 },

  // Sajten har en enda sida. Allt annat okänt är ett riktigt 404 (ADR-13).
  { from: `${BASE}*`, to: `${BASE}404.html`, status: 404 },
];

export const headers: ReadonlyArray<{ for: string; values: Record<string, string> }> = [
  {
    for: '/*',
    values: {
      // Själva policyn ligger som <meta http-equiv> per sida (ADR-12) eftersom den behöver
      // skilja sig åt; headern bär bara det meta inte kan uttrycka.
      'Content-Security-Policy': "frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  // Vite ger innehållshashade filnamn → kan cachas för alltid.
  { for: `${BASE}assets/*`, values: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  // Vendorerade bibliotek ligger under versionerad sökväg (vendor/origo-2.10.0/…).
  { for: `${BASE}vendor/*`, values: { 'Cache-Control': 'public, max-age=2592000, immutable' } },
  // Geodata (PMTiles, GeoJSON, sökindex). PMTiles läses med Range-requests; ETag avslöjar ny version.
  {
    for: `${BASE}data/*`,
    values: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Accept-Ranges': 'bytes',
    },
  },
];

/** `_redirects`: en regel per rad, "från till status". */
export function renderRedirects(): string {
  const lines = redirects.map(({ from, to, status }) => `${from}  ${to}  ${status}`);
  return `# Genererad av netlify/rules.mjs vid bygget — redigera inte för hand (ADR-17).\n${lines.join('\n')}\n`;
}

/** `_headers`: sökväg på egen rad, därefter indenterade "Header: värde". */
export function renderHeaders(): string {
  const blocks = headers.map(({ for: path, values }) => {
    const rows = Object.entries(values).map(([key, value]) => `  ${key}: ${value}`);
    return `${path}\n${rows.join('\n')}`;
  });
  return `# Genererad av netlify/rules.mjs vid bygget — redigera inte för hand (ADR-17).\n${blocks.join('\n\n')}\n`;
}
