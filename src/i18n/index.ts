/**
 * Lättviktig i18n utan runtime-bibliotek (§4.3, FK-34).
 *
 * Språk väljs i ordning: URL-segment efter basen (`/sv/`, `/en/`) → `?lang=` →
 * webbläsarens språk vid första besök → svenska. Ingen lagring i cookies eller
 * localStorage (NFK-21); språket bärs av URL:en.
 */
import { BASE } from '../config/site.ts';
import { en } from './en.ts';
import { sv, type MessageKey } from './sv.ts';

export type Lang = 'sv' | 'en';

const CATALOGS: Record<Lang, Record<MessageKey, string>> = { sv, en };

let current: Lang = 'sv';

export function detectLang(location: Pick<Location, 'pathname' | 'search'>, navigatorLangs: readonly string[]): Lang {
  const rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  const first = rest.split('/')[0];
  if (first === 'en' || first === 'sv') return first;

  const param = new URLSearchParams(location.search).get('lang');
  if (param === 'en' || param === 'sv') return param;

  for (const l of navigatorLangs) {
    const short = l.slice(0, 2).toLowerCase();
    if (short === 'sv') return 'sv';
    if (short === 'en') return 'en';
  }
  return 'sv';
}

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Dynamiska nycklar (t.ex. `bad.level.${level}`) tillåts; saknad nyckel faller tillbaka på svenska, sist på nyckeln själv. */
export function t(key: MessageKey | (string & {})): string {
  const k = key as MessageKey;
  return CATALOGS[current][k] ?? CATALOGS.sv[k] ?? key;
}

/** Byter ut all text märkt med data-i18n / data-i18n-aria och sätter <html lang>. */
export function applyI18n(root: Document): void {
  root.documentElement.lang = current;
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset['i18n'] as MessageKey | undefined;
    if (key && key in CATALOGS.sv) el.textContent = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = el.dataset['i18nAria'] as MessageKey | undefined;
    if (key && key in CATALOGS.sv) el.setAttribute('aria-label', t(key));
  }
}

export function initI18n(): Lang {
  setLang(detectLang(window.location, navigator.languages ?? [navigator.language]));
  applyI18n(document);
  return current;
}
