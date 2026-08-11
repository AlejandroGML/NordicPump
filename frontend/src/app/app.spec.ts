import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { App } from './app';
import { LanguageService } from './core/services/lang.service';
import { SUPPORTED_LANGS, type SupportedLang } from './core/models/lang';

/**
 * Fake loader for translation testing.
 */
class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string) {
    return of({
      nav: { dashboard: 'Dashboard' },
      footer: {
        copyright: '© {year} NordicPump',
        dataSources: 'Data from fuel-prices.eu (CC BY 4.0) and SSB Statbank',
      },
      language: { selector: 'Select Language' },
    });
  }
}

/**
 * Spec: layout-shell > AppComponent Shell
 * - Root AppComponent MUST contain router-outlet in semantic layout with header + footer
 * - Responsive container: max-w-7xl mx-auto px-4
 * - Set lang attribute on <html> from LanguageService
 * - Sticky footer pattern
 */
describe('App', () => {
  let fixture: ComponentFixture<App>;
  let component: App;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          {
            path: ':lang',
            children: [{ path: 'dashboard', component: class {} }],
          },
        ]),
        provideTranslateService({
          lang: 'sv',
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
        {
          provide: LanguageService,
          useValue: {
            getCurrentLanguage: () => 'sv' as SupportedLang,
            setLanguage: () => {},
            getSupportedLanguages: () => SUPPORTED_LANGS,
            initLanguage: () => 'sv' as SupportedLang,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('layout shell structure', () => {
    it('should render the header component', () => {
      const header = fixture.nativeElement.querySelector('app-header');
      expect(header).toBeTruthy();
    });

    it('should render the footer component', () => {
      const footer = fixture.nativeElement.querySelector('app-footer');
      expect(footer).toBeTruthy();
    });

    it('should render a router-outlet', () => {
      const outlet = fixture.nativeElement.querySelector('router-outlet');
      expect(outlet).toBeTruthy();
    });

    it('should have header before router-outlet and footer after', () => {
      const rootEl = fixture.nativeElement as HTMLElement;
      // The layout wraps content in a root div: <div> → header, main, footer
      const wrapper = rootEl.querySelector(':scope > div.flex');
      expect(wrapper).toBeTruthy();

      const children = Array.from(wrapper!.children);
      const tagNames = children.map((c) => c.tagName.toLowerCase());

      const headerIdx = tagNames.indexOf('app-header');
      const mainIdx = tagNames.indexOf('main');
      const footerIdx = tagNames.indexOf('app-footer');

      expect(headerIdx).toBeGreaterThan(-1);
      expect(mainIdx).toBeGreaterThan(-1);
      expect(footerIdx).toBeGreaterThan(-1);
      expect(headerIdx).toBeLessThan(mainIdx);
      expect(mainIdx).toBeLessThan(footerIdx);

      // Verify router-outlet is inside <main>
      const main = wrapper!.querySelector('main');
      expect(main).toBeTruthy();
      const outlet = main!.querySelector('router-outlet');
      expect(outlet).toBeTruthy();
    });
  });

  describe('responsive container', () => {
    it('should wrap content in a container with max-w-7xl', () => {
      const main = fixture.nativeElement.querySelector('main');
      expect(main).toBeTruthy();
      expect(main.className).toContain('max-w-7xl');
    });

    it('should have px-4 padding on the container', () => {
      const main = fixture.nativeElement.querySelector('main');
      expect(main.className).toContain('px-4');
    });

    it('should have mx-auto center alignment', () => {
      const main = fixture.nativeElement.querySelector('main');
      expect(main.className).toContain('mx-auto');
    });
  });

  describe('sticky footer', () => {
    it('should use flex column layout to push footer to bottom', () => {
      const root = fixture.nativeElement.querySelector(':first-child');
      // The root div should use flex-col and min-h-screen for sticky footer
      const classes = root?.className ?? '';
      const hasFlexCol = classes.includes('flex') && classes.includes('flex-col');
      const hasMinHeight = classes.includes('min-h-screen');
      expect(hasFlexCol).toBe(true);
      expect(hasMinHeight).toBe(true);
    });
  });
});
