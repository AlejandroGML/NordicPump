import { describe, it, expect } from 'vitest';
import {
  type SupportedLang,
  SUPPORTED_LANGS,
  LANG_NATIVE_NAMES,
  DEFAULT_LANG,
  FALLBACK_LANG,
} from './lang';

/**
 * Spec: i18n-setup > Language Detection Chain
 * - SupportedLang = 'sv' | 'da' | 'nb' | 'fi' | 'en' | 'es'
 * - DEFAULT_LANG = 'sv'
 * - FALLBACK_LANG = 'sv'
 * - LANG_NATIVE_NAMES has native names for all 6
 * - SUPPORTED_LANGS contains all 6
 */
describe('Lang model — types and constants', () => {
  describe('SupportedLang type', () => {
    it('should accept valid language codes', () => {
      const valid: SupportedLang[] = ['sv', 'da', 'nb', 'fi', 'en', 'es', 'is'];
      expect(valid).toHaveLength(7);
    });
  });

  describe('SUPPORTED_LANGS', () => {
    it('should contain exactly 7 languages', () => {
      expect(SUPPORTED_LANGS).toHaveLength(7);
    });

    it('should include sv, da, nb, fi, en, es, is in that order', () => {
      expect(SUPPORTED_LANGS).toEqual(['sv', 'da', 'nb', 'fi', 'en', 'es', 'is']);
    });

    it('should be frozen at runtime (immutable)', () => {
      expect(Object.isFrozen(SUPPORTED_LANGS)).toBe(true);
    });
  });

  describe('LANG_NATIVE_NAMES', () => {
    it('should have entries for all 7 supported languages', () => {
      const keys = Object.keys(LANG_NATIVE_NAMES);
      expect(keys).toHaveLength(7);
      expect(keys).toContain('sv');
      expect(keys).toContain('da');
      expect(keys).toContain('nb');
      expect(keys).toContain('fi');
      expect(keys).toContain('en');
      expect(keys).toContain('es');
    });

    it('should use native names (not English names)', () => {
      expect(LANG_NATIVE_NAMES['sv']).toBe('Svenska');
      expect(LANG_NATIVE_NAMES['da']).toBe('Dansk');
      expect(LANG_NATIVE_NAMES['nb']).toBe('Norsk bokmål');
      expect(LANG_NATIVE_NAMES['fi']).toBe('Suomi');
      expect(LANG_NATIVE_NAMES['en']).toBe('English');
      expect(LANG_NATIVE_NAMES['es']).toBe('Español');
    });
  });

  describe('DEFAULT_LANG', () => {
    it('should be sv', () => {
      expect(DEFAULT_LANG).toBe('sv');
    });
  });

  describe('FALLBACK_LANG', () => {
    it('should be sv (same as default)', () => {
      expect(FALLBACK_LANG).toBe('sv');
    });
  });
});
