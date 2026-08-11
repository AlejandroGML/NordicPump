/**
 * Language type definitions for NordicPump i18n.
 *
 * Spec: i18n-setup > Language Detection Chain
 * - SupportedLang = 'sv' | 'da' | 'nb' | 'fi' | 'en' | 'es'
 * - DEFAULT_LANG = FALLBACK_LANG = 'sv'
 */

/** All language codes supported by the application. */
export const SUPPORTED_LANGS = Object.freeze([
  'sv',
  'da',
  'nb',
  'fi',
  'en',
  'es',
  'is',
] as const);

/** Union type of supported two-letter language codes. */
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** Native-language display names — used in the language switcher. */
export const LANG_NATIVE_NAMES: Record<SupportedLang, string> = {
  sv: 'Svenska',
  da: 'Dansk',
  nb: 'Norsk bokmål',
  fi: 'Suomi',
  en: 'English',
  es: 'Español',
  is: 'Íslenska',
};

/** Default language used when no preference is detected. */
export const DEFAULT_LANG: SupportedLang = 'sv';

/** Fallback language for missing translation keys. */
export const FALLBACK_LANG: SupportedLang = 'sv';

/** Type guard: checks if a string is a supported language code. */
export function isSupportedLang(value: string): value is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(value);
}
