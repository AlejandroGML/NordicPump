/**
 * Date formatting helpers — locale-aware.
 */

/** Parse a date string as UTC to avoid off-by-one errors in negative-offset timezones.
 *
 * Date-only strings (YYYY-MM-DD) are treated as UTC midnight; ISO strings
 * with a time component are passed through unchanged. */
export function parseDateUtc(dateStr: string): Date {
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`;
  return new Date(normalized);
}

/** Locale used to format dates per supported UI language. */
export const LANG_LOCALE: Record<string, string> = {
  sv: 'sv-SE',
  da: 'da-DK',
  nb: 'nb-NO',
  fi: 'fi-FI',
  en: 'en-GB',
  es: 'es-ES',
};

/** Resolve the date locale for a language code (falls back to en-GB). */
export function localeForLang(lang: string | undefined): string {
  return (lang && LANG_LOCALE[lang]) || 'en-GB';
}

/** Format a UTC date in the given language's locale: "22 Jun 2026". */
export function formatDateLocalized(
  dateStr: string,
  lang: string | undefined,
): string {
  return parseDateUtc(dateStr).toLocaleDateString(localeForLang(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
