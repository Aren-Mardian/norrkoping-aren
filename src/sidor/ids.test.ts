/**
 * Länkarna i skalet och sidorna i koden måste hålla ihop.
 *
 * `data-sida` i index.html är det enda som kopplar en länk till en informationssida. Stavas den
 * fel händer ingenting alls när man klickar — inget fel i konsolen, ingen dialog, bara en länk
 * som inte gör något. Det är precis den sortens fel som inte upptäcks förrän någon rapporterar
 * det, så det testas här i stället.
 *
 * Innehållet (`innehall.ts`) importeras medvetet inte: det läser byggvariabler som bara finns
 * under Vite, inte i testkörningen.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sidaFromHash } from './ids.ts';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('sidaFromHash', () => {
  it('känner igen sidornas adresser, med och utan brädgård', () => {
    expect(sidaFromHash('#om')).toBe('om');
    expect(sidaFromHash('kallor')).toBe('kallor');
    expect(sidaFromHash('#integritet')).toBe('integritet');
  });

  it('avvisar allt annat i stället för att gissa', () => {
    for (const hash of ['', '#', '#karta', '#OM', '#om/', 'https://example.com']) {
      expect(sidaFromHash(hash)).toBeNull();
    }
  });
});

describe('index.html', () => {
  const sidor = [...html.matchAll(/data-sida="([^"]*)"/g)].map((m) => m[1] ?? '');

  it('har länkar till alla tre sidorna', () => {
    expect(new Set(sidor)).toEqual(new Set(['om', 'kallor', 'integritet']));
  });

  it('varje data-sida pekar på en sida som finns', () => {
    for (const id of sidor) expect(sidaFromHash(id)).toBe(id);
  });

  it('varje sidlänk har ett href som matchar sitt data-sida', () => {
    for (const m of html.matchAll(/<a\s[^>]*data-sida="([^"]+)"[^>]*>/g)) {
      const tag = m[0];
      expect(tag).toContain(`href="#${m[1]}"`);
    }
  });

  it('inga kvarglömda länkar till portfolions rot där en sida menades', () => {
    // Länkarna gick till https://arenm.se/ innan sidorna fanns i appen (2026-09-24).
    const footerLinks = html.match(/<nav class="footer__links"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(footerLinks).not.toContain('arenm.se');
  });
});
