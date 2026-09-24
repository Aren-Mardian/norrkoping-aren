/**
 * Regelfilerna får inte glida isär (ADR-17).
 *
 * Headerreglerna finns på två ställen med flit: `netlify/rules.ts` skriver `_headers` vid bygget,
 * och `netlify.toml` bär samma uppsättning eftersom Netlify låter toml-filen vinna vid konflikt.
 * Dubbleringen finns för att en gammal version av netlify.toml visade sig ligga kvar i drift och
 * slå ut `_headers` (se kommentaren i netlify.toml). Det här testet ser till att de två alltid
 * säger samma sak — annars är dubbleringen farligare än problemet den löser.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headers, redirects, renderHeaders, renderRedirects } from './rules.ts';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

/** Diagnostikmarkör, se netlify.toml. Ska bort när Netlifys konfiguration är utredd. */
const DIAGNOSTIC = new Set(['X-Config-Source']);

describe('netlify.toml speglar netlify/rules.ts', () => {
  it.each(headers.map((h) => [h.for, h] as const))('sökvägen %s finns med samma värden', (path, rule) => {
    expect(toml).toContain(`for = "${path}"`);
    for (const [key, value] of Object.entries(rule.values)) {
      expect(toml).toContain(`${key} = "${value}"`);
    }
  });

  it('toml lägger inte till egna headers utöver reglerna och diagnostikmarkören', () => {
    const known = new Set(headers.flatMap((h) => Object.keys(h.values)));
    const inToml = [...toml.matchAll(/^ {4}([A-Za-z-]+) = "/gm)].map((m) => m[1]!);
    expect(inToml.filter((k) => !known.has(k) && !DIAGNOSTIC.has(k))).toEqual([]);
  });

  it('ingen bred regel för hela sajten: den vann tidigare över assets-regeln och gav no-cache', () => {
    expect(toml).not.toContain('for = "/projekt/norrkoping/*"');
  });

  it('cachereglerna är de som NFK-04 kräver', () => {
    const rendered = renderHeaders();
    expect(rendered).toContain('Cache-Control: public, max-age=31536000, immutable');
    expect(rendered).toContain('Accept-Ranges: bytes');
  });
});

describe('omdirigeringar', () => {
  it('fångsten står sist, annars skuggar den de specifika reglerna', () => {
    expect(redirects.at(-1)?.from).toBe('/projekt/norrkoping/*');
    expect(redirects.at(-1)?.status).toBe(404);
  });

  it('_redirects har en rad per regel och ingen tom rad i mitten', () => {
    const lines = renderRedirects().trimEnd().split('\n');
    expect(lines.filter((l) => !l.startsWith('#'))).toHaveLength(redirects.length);
  });
});
