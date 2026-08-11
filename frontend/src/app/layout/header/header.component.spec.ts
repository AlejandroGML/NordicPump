import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { HeaderComponent } from './header.component';
import { LanguageService } from '@core/services/lang.service';
import { SUPPORTED_LANGS } from '@core/models/lang';

/**
 * Fake loader that returns translations used in header tests.
 */
class FakeLoader implements TranslateLoader {
  getTranslation(_lang: string) {
    return of({
      nav: { dashboard: 'Dashboard' },
    });
  }
}

/**
 * Spec: layout-shell > Header Component
 * - Display logo, nav links (Dashboard), language switcher
 * - Desktop ≥768px: logo left, nav center, switcher right, sticky
 * - Mobile <768px: logo + hamburger, nav in slide-out drawer, switcher in drawer
 * - role="banner" for a11y
 *
 * Design tokens:
 * - Header bg: primary (#1E40AF), text: white
 * - Logo font: Fira Sans bold
 * - Accent (#F59E0B) for active nav / hover states
 */
describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([
          {
            path: ':lang',
            children: [{ path: 'dashboard', component: class {} }],
          },
        ]),
        provideTranslateService({
          lang: 'en',
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
        {
          provide: LanguageService,
          useValue: {
            getCurrentLanguage: () => 'sv',
            setLanguage: () => {},
            getSupportedLanguages: () => SUPPORTED_LANGS,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('structure and a11y', () => {
    it('should have role="banner" on the header element', () => {
      const header = fixture.nativeElement.querySelector('header');
      expect(header).toBeTruthy();
      expect(header.getAttribute('role')).toBe('banner');
    });

    it('should render the logo text "NordicPump"', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('NordicPump');
    });

    it('should render a navigation link to the dashboard', () => {
      const navLinks = fixture.nativeElement.querySelectorAll(
        'a[routerLink], a[href*="dashboard"]',
      );
      // At minimum one nav link exists
      expect(navLinks.length).toBeGreaterThan(0);
    });
  });

  describe('header content', () => {
    it('should contain the language switcher component', () => {
      const switcher =
        fixture.nativeElement.querySelector('app-language-switcher');
      expect(switcher).toBeTruthy();
    });

    it('should have the logo as a visible heading or link element', () => {
      const logoElements = fixture.nativeElement.querySelectorAll(
        'a[href*="dashboard"], h1, .logo',
      );
      // At least one logo-related element exists
      const hasLogoContent = Array.from(logoElements as NodeListOf<Element>).some(el =>
        el.textContent?.includes('NordicPump'),
      );
      expect(hasLogoContent).toBe(true);
    });
  });

  describe('responsive layout', () => {
    it('should render a hamburger menu button for mobile', () => {
      // MVP: simple nav — hamburger button still present for future expansion
      const hamburger = fixture.nativeElement.querySelector(
        'button[aria-label*="Menu"], button[aria-label*="menu"]',
      );
      // May be inside a responsive container — verify accessibility label
      expect(hamburger).toBeTruthy();
    });

    it('should have sticky positioning', () => {
      const header = fixture.nativeElement.querySelector('header');
      // Sticky is applied via Tailwind class or style
      const isSticky =
        header.className.includes('sticky') ||
        header.className.includes('fixed') ||
        header.style.position === 'sticky';
      expect(isSticky).toBe(true);
    });
  });
});
