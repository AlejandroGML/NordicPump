import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { FooterComponent } from './footer.component';

/**
 * Spec: layout-shell > Footer Component
 * - Show copyright + data source attributions to fuel-prices.eu (CC BY 4.0) and SSB Statbank
 * - Attribution links open in new tab with rel="noopener noreferrer"
 * - Copyright includes current year
 * - role="contentinfo" for a11y
 *
 * Design tokens:
 * - Footer bg: gray-100, text: text (#1E3A8A)
 */
describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;
  let component: FooterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: {
            instant: (k: string) => k,
            translate: (k: string) => of(k),
            stream: () => of(''),
            onLangChange: of({}),
            currentLang: () => 'es',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('structure and a11y', () => {
    it('should have role="contentinfo" on the footer element', () => {
      const footer = fixture.nativeElement.querySelector('footer');
      expect(footer).toBeTruthy();
      expect(footer.getAttribute('role')).toBe('contentinfo');
    });

    it('should render copyright text with current year', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const currentYear = new Date().getFullYear().toString();
      expect(compiled.textContent).toContain('NordicPump');
      expect(compiled.textContent).toContain(currentYear);
    });
  });

  describe('attribution links', () => {
    it('should link to fuel-prices.eu', () => {
      const link = fixture.nativeElement.querySelector(
        'a[href*="fuel-prices.eu"]',
      ) as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.href).toContain('fuel-prices.eu');
    });

    it('should link to ssb.no', () => {
      const link = fixture.nativeElement.querySelector(
        'a[href*="ssb.no"]',
      ) as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.href).toContain('ssb.no');
    });

    it('should have rel="noopener noreferrer" on attribution links', () => {
      const links = fixture.nativeElement.querySelectorAll(
        'a[rel]',
      ) as NodeListOf<HTMLAnchorElement>;
      const attribLinks = Array.from(links).filter(
        (l) =>
          l.href.includes('fuel-prices.eu') || l.href.includes('ssb.no'),
      );
      expect(attribLinks.length).toBeGreaterThan(0);
      for (const link of attribLinks) {
        expect(link.rel).toBe('noopener noreferrer');
      }
    });

    it('should open attribution links in new tab', () => {
      const links = fixture.nativeElement.querySelectorAll(
        'a[target]',
      ) as NodeListOf<HTMLAnchorElement>;
      const attribLinks = Array.from(links).filter(
        (l) =>
          l.href.includes('fuel-prices.eu') || l.href.includes('ssb.no'),
      );
      for (const link of attribLinks) {
        expect(link.target).toBe('_blank');
      }
    });
  });
});
