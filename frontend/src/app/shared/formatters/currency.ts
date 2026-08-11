/**
 * Shared currency formatting utilities.
 *
 * Provides locale-aware number formatting for SEK, EUR, and arbitrary
 * native currencies. All dashboard components should import from here
 * instead of duplicating Intl.NumberFormat instances.
 */

/** Locale map for native currency codes. */
const LOCALE_MAP: Record<string, string> = {
  EUR: 'sv-SE',
  DKK: 'da-DK',
  NOK: 'nb-NO',
};

/**
 * Format a SEK value using sv-SE locale.
 * Uses decimal style (no currency symbol) with 2 fixed fraction digits.
 *
 * @example formatSek(1765.50) → "1 765,50"
 */
export function formatSek(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a EUR value using sv-SE locale with 2-3 fraction digits.
 *
 * @example formatEur(1.535) → "1,535"
 */
export function formatEur(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Format a value in the given native currency code.
 * Maps currency codes to appropriate locales:
 *   EUR → sv-SE, DKK → da-DK, NOK → nb-NO
 * Falls back to sv-SE for unknown currencies.
 *
 * @example formatNative(15.64, 'DKK') → "15,64"
 */
export function formatNative(value: number, currency: string): string {
  const locale = LOCALE_MAP[currency] ?? 'sv-SE';
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
