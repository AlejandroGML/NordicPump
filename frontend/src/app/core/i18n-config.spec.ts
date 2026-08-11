import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Spec: i18n-setup > Translation File Structure
 * - JSON at assets/i18n/{lang}.json with nested component-scoped keys
 * - Each file must have: app.title, nav.dashboard, footer.copyright,
 *   footer.dataSources, language.selector
 *
 * Spec: i18n-setup > Language Detection Chain
 * - ngx-translate configured with TranslateHttpLoader from /assets/i18n/
 * - Default language: sv, Fallback: sv
 */

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const I18N_DIR = resolve(PROJECT_ROOT, 'public', 'assets', 'i18n');
const SUPPORTED_LANGS = ['sv', 'da', 'nb', 'fi', 'en', 'es'];
const REQUIRED_KEYS = [
  'app.title',
  'nav.dashboard',
  'footer.copyright',
  'footer.dataSources',
  'language.selector',
];

describe('Translation Files — assets/i18n/', () => {
  describe.each(SUPPORTED_LANGS)('%s.json', (lang) => {
    const filePath = resolve(I18N_DIR, `${lang}.json`);

    it('should exist', () => {
      expect(existsSync(filePath)).toBe(true);
    });

    it('should be valid JSON', () => {
      const content = readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have all required top-level keys', () => {
      const content = readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      expect(json).toHaveProperty('app');
      expect(json).toHaveProperty('nav');
      expect(json).toHaveProperty('footer');
      expect(json).toHaveProperty('language');
    });

    describe.each(REQUIRED_KEYS)('nested key: %s', (keyPath) => {
      it('should be a non-empty string', () => {
        const content = readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        const parts = keyPath.split('.');
        let value = json;
        for (const part of parts) {
          value = value[part];
        }
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Language-specific content', () => {
    it('sv.json should contain Swedish text for app.title', () => {
      const json = JSON.parse(
        readFileSync(resolve(I18N_DIR, 'sv.json'), 'utf-8'),
      );
      // Swedish text must contain Nordic/nordic characters or recognizable words
      expect(json.app.title).toMatch(/Nordic|Pump|Bränsle/);
    });

    it('en.json should contain English text for app.title', () => {
      const json = JSON.parse(
        readFileSync(resolve(I18N_DIR, 'en.json'), 'utf-8'),
      );
      expect(json.app.title).toMatch(/Nordic|Pump|Fuel/);
    });

    it('da.json should differ from sv.json for at least one key', () => {
      const sv = JSON.parse(
        readFileSync(resolve(I18N_DIR, 'sv.json'), 'utf-8'),
      );
      const da = JSON.parse(
        readFileSync(resolve(I18N_DIR, 'da.json'), 'utf-8'),
      );
      const allSame = REQUIRED_KEYS.every((key) => {
        const parts = key.split('.');
        let svVal = sv, daVal = da;
        for (const p of parts) { svVal = svVal[p]; daVal = daVal[p]; }
        return svVal === daVal;
      });
      expect(allSame).toBe(false);
    });
  });
});

describe('ngx-translate Configuration', () => {
  it('should have @ngx-translate/core in package.json', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8'),
    );
    expect(pkg.dependencies['@ngx-translate/core']).toBeDefined();
  });

  it('should have @ngx-translate/http-loader in package.json', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8'),
    );
    expect(pkg.dependencies['@ngx-translate/http-loader']).toBeDefined();
  });

  it('app.config.ts should include provideTranslateService', () => {
    const configContent = readFileSync(
      resolve(import.meta.dirname, '..', 'app.config.ts'),
      'utf-8',
    );
    expect(configContent).toContain('provideTranslateService');
  });

  it('app.config.ts should use TranslateHttpLoader for /assets/i18n/', () => {
    const configContent = readFileSync(
      resolve(import.meta.dirname, '..', 'app.config.ts'),
      'utf-8',
    );
    expect(configContent).toContain('TranslateHttpLoader');
    expect(configContent).toContain('/assets/i18n/');
  });
});
