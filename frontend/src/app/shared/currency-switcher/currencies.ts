/**
 * GENERATED FILE — DO NOT EDIT. Run: python scripts/generate_countries.py.
 * Source: countries.json
 */
export type Currency = 'SEK' | 'EUR' | 'DKK' | 'NOK' | 'ISK';
export const CURRENCIES: readonly Currency[] = ['SEK', 'EUR', 'DKK', 'NOK', 'ISK'] as const;
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  SEK: 'kr',
  EUR: '€',
  DKK: 'kr',
  NOK: 'kr',
  ISK: 'kr',
};
export const CURRENCY_LOCALES: Record<Currency, string> = {
  SEK: 'sv-SE',
  EUR: 'sv-SE',
  DKK: 'da-DK',
  NOK: 'nb-NO',
  ISK: 'is-IS',
};
