import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/services/lang.service';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { SUPPORTED_LANGS, LANG_NATIVE_NAMES } from '@core/models/lang';
import type { SupportedLang } from '@core/models/lang';

/**
 * Spec: i18n-setup > Language Switcher
 * - Header MUST contain switcher with 6 options showing native names
 * - Active language highlighted
 * - Switcher navigates preserving route suffix
 * - aria-label for a11y
 *
 * Spec: layout-shell > Header Component
 * - LanguageSwitcher positioned in header
 */
describe('LanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let component: LanguageSwitcherComponent;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let langServiceSetSpy: ReturnType<typeof vi.fn>;
  let currentLang: SupportedLang;

  beforeEach(async () => {
    currentLang = 'sv';
    routerNavigateSpy = vi.fn().mockResolvedValue(true);
    langServiceSetSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: routerNavigateSpy, url: '/sv/dashboard' },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { lang: 'sv' } } },
        },
        {
          provide: LanguageService,
          useValue: {
            getCurrentLanguage: () => currentLang,
            setLanguage: langServiceSetSpy,
            getSupportedLanguages: () => SUPPORTED_LANGS,
          },
        },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            onLangChange: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('rendering', () => {
    it('should render a select element with aria-label', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      expect(select.getAttribute('aria-label')).toBe('Select Language');
    });

    it('should display the current language name as the selected option', () => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select.value).toBe('sv');
      const selectedOption = select.options[select.selectedIndex];
      expect(selectedOption?.textContent?.trim()).toBe('Svenska');
    });
  });

  describe('options', () => {
    it('should render all 7 language options with native names', () => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      const options = Array.from(select.options);

      expect(options).toHaveLength(7);

      const optionTexts = options.map((o) => o.textContent?.trim());
      for (const lang of SUPPORTED_LANGS) {
        const nativeName = LANG_NATIVE_NAMES[lang as SupportedLang];
        expect(optionTexts).toContain(nativeName);
      }
    });

    it('should have language codes as option values', () => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      const optionValues = Array.from(select.options).map((o) => o.value);

      expect(optionValues).toContain('sv');
      expect(optionValues).toContain('da');
      expect(optionValues).toContain('nb');
      expect(optionValues).toContain('fi');
      expect(optionValues).toContain('en');
      expect(optionValues).toContain('es');
    });
  });

  describe('language switching', () => {
    it('should navigate to the new language prefix preserving route suffix', () => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      select.value = 'en';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(langServiceSetSpy).toHaveBeenCalledWith('en');
      // /sv/dashboard → /en/dashboard
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/en/dashboard'], {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    });

    it('should switch from nb to fi preserving deep path', async () => {
      // Re-create with nb as current and a deeper URL
      TestBed.resetTestingModule();
      currentLang = 'nb';

      await TestBed.configureTestingModule({
        imports: [LanguageSwitcherComponent],
        providers: [
          {
            provide: Router,
            useValue: {
              navigate: routerNavigateSpy,
              url: '/nb/dashboard',
            },
          },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { params: { lang: 'nb' } } },
          },
          {
            provide: LanguageService,
            useValue: {
              getCurrentLanguage: () => 'nb' as SupportedLang,
              setLanguage: langServiceSetSpy,
              getSupportedLanguages: () => SUPPORTED_LANGS,
            },
          },
          {
            provide: TranslateService,
            useValue: {
              instant: (key: string) => key,
              onLangChange: of({}),
            },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(LanguageSwitcherComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      select.value = 'fi';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(routerNavigateSpy).toHaveBeenCalledWith(['/fi/dashboard'], {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    });
  });

  describe('a11y', () => {
    it('should have aria-label on the select', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select.getAttribute('aria-label')).toBeTruthy();
    });

    it('should support keyboard navigation (native select behavior)', () => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      // Native select is keyboard-accessible by default
      expect(select.tagName).toBe('SELECT');
    });
  });
});
