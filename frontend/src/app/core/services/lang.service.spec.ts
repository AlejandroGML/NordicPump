import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from './lang.service';

/**
 * Spec: i18n-setup > Language Detection Chain
 * - localStorage lang → navigator.language primary subtag → sv fallback
 * - setLanguage: saves to localStorage, switches translate service
 * - getCurrentLanguage: returns current lang
 * - getSupportedLanguages: returns list of 6
 */
describe('LanguageService', () => {
  let service: LanguageService;
  let translateServiceMock: { use: ReturnType<typeof vi.fn> };
  let store: Record<string, string>;
  let navigatorLanguageMock: string;

  beforeEach(async () => {
    store = {};

    // Replace localStorage entirely for jsdom compatibility
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
        length: 0,
        key: vi.fn(() => null),
      },
      writable: true,
    });

    navigatorLanguageMock = 'en-US';
    vi.spyOn(Navigator.prototype, 'language', 'get').mockImplementation(
      () => navigatorLanguageMock,
    );

    translateServiceMock = { use: vi.fn() };

    await TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: translateServiceMock },
      ],
    });

    service = TestBed.inject(LanguageService);
  });

  describe('getSupportedLanguages', () => {
    it('should return 7 supported languages', () => {
      const langs = service.getSupportedLanguages();
      expect(langs).toHaveLength(7);
    });

    it('should include sv, da, nb, fi, en, es', () => {
      const langs = service.getSupportedLanguages();
      expect(langs).toContain('sv');
      expect(langs).toContain('da');
      expect(langs).toContain('nb');
      expect(langs).toContain('fi');
      expect(langs).toContain('en');
      expect(langs).toContain('es');
    });
  });

  describe('initLanguage', () => {
    it('should use localStorage value when present', () => {
      store['lang'] = 'da';
      const lang = service.initLanguage();
      expect(lang).toBe('da');
    });

    it('should use navigator.language primary subtag when no localStorage', () => {
      navigatorLanguageMock = 'nb-NO';
      const lang = service.initLanguage();
      expect(lang).toBe('nb');
    });

    it('should extract primary subtag from complex locale', () => {
      navigatorLanguageMock = 'sv-SE';
      const lang = service.initLanguage();
      expect(lang).toBe('sv');
    });

    it('should fallback to sv when navigator.language is unsupported', () => {
      navigatorLanguageMock = 'de-DE';
      const lang = service.initLanguage();
      expect(lang).toBe('sv');
    });

    it('should fallback to sv when navigator.language is empty', () => {
      navigatorLanguageMock = '';
      const lang = service.initLanguage();
      expect(lang).toBe('sv');
    });
  });

  describe('setLanguage', () => {
    it('should save language to localStorage', () => {
      service.setLanguage('fi');
      expect(store['lang']).toBe('fi');
    });

    it('should update current language', () => {
      service.setLanguage('en');
      expect(service.getCurrentLanguage()).toBe('en');
    });

    it('should update html lang attribute', () => {
      service.setLanguage('da');
      const htmlLang = document.documentElement.getAttribute('lang');
      expect(htmlLang).toBe('da');
    });

    it('should set html dir to ltr', () => {
      service.setLanguage('es');
      const dir = document.documentElement.getAttribute('dir');
      expect(dir).toBe('ltr');
    });
  });

  describe('getCurrentLanguage', () => {
    it('should return default language before init', () => {
      expect(service.getCurrentLanguage()).toBe('sv');
    });

    it('should return set language after setLanguage', () => {
      service.setLanguage('nb');
      expect(service.getCurrentLanguage()).toBe('nb');
    });
  });
});
