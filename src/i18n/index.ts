/**
 * Texter på ett ställe (§4.3). Sajten är enspråkigt svensk sedan 2026-09-23 (ADR-15) — den
 * engelska katalogen och språkvalet togs bort på uppdrag. Katalogen finns kvar som en modul
 * i stället för strängar utspridda i koden: den ger en enda plats att rätta formuleringar på,
 * och `data-i18n` i HTML:en gör att skalet och JavaScript-koden alltid säger samma sak.
 */
import { sv, type MessageKey } from './sv.ts';

/** Locale för datum, tid och tal. */
export const LOCALE = 'sv-SE';

/** Dynamiska nycklar (t.ex. `bad.level.${level}`) tillåts; saknad nyckel faller tillbaka på nyckeln själv. */
export function t(key: MessageKey | (string & {})): string {
  return sv[key as MessageKey] ?? key;
}

/** Byter ut text märkt med data-i18n / data-i18n-aria / data-i18n-title. */
export function applyI18n(root: Document): void {
  root.documentElement.lang = 'sv';
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset['i18n'] as MessageKey | undefined;
    if (key && key in sv) el.textContent = t(key);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = el.dataset['i18nAria'] as MessageKey | undefined;
    if (key && key in sv) el.setAttribute('aria-label', t(key));
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const key = el.dataset['i18nTitle'] as MessageKey | undefined;
    if (key && key in sv) el.title = t(key);
  }
}

export function initI18n(): void {
  applyI18n(document);
}
