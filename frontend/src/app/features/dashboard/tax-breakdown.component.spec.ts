import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { CountryStateService } from '@core/services/country-state.service';
import { TaxBreakdownComponent } from './tax-breakdown.component';

const mockPrice = {
  country: 'SE',
  prices: [
    {
      country: 'SE', fuel: 'euro_95', price_eur: 1.535, price_sek: 17.65,
      price_native: 1.535, price_native_currency: 'EUR', date: '2026-06-22', frequency: 'weekly',
    },
    {
      country: 'SE', fuel: 'diesel', price_eur: 1.702, price_sek: 19.57,
      price_native: 1.702, price_native_currency: 'EUR', date: '2026-06-22', frequency: 'weekly',
    },
  ],
};

/**
 * Spec: tax-breakdown
 * - Stacked bar chart showing price composition
 * - Derives breakdown from Swedish reference rates
 * - Accessible data table
 */
describe('TaxBreakdownComponent', () => {
  let fixture: ComponentFixture<TaxBreakdownComponent>;
  let httpMock: HttpTestingController;
  let service: CountryStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxBreakdownComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CountryStateService,
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => {
              const t: Record<string, string> = {
                'dashboard.tax.title': 'Tax Breakdown',
                'dashboard.tax.product': 'Product Cost',
                'dashboard.tax.excise': 'Excise Duty',
                'dashboard.tax.vat': 'VAT',
                'dashboard.tax.other': 'Other Taxes',
                'dashboard.tax.derivedNote': 'Estimated from reference rates',
                'dashboard.tax.error': '[translated] Tax error',
                'dashboard.price.euro95': 'Euro 95',
                'dashboard.price.diesel': 'Diesel',
              };
              return t[key] ?? key;
            },
            translate: (key: string) => of(key),
            stream: () => of(''),
            onLangChange: of({}),
            onTranslationChange: of({}),
            onDefaultLangChange: of({}),
            currentLang: 'en',
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CountryStateService);
    service.setCountry('SE');
  });

  function createAndFlush(mockData = mockPrice) {
    fixture = TestBed.createComponent(TaxBreakdownComponent);
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/prices/SE');
    req.flush(mockData);
    fixture.detectChanges();
  }

  describe('stacked chart', () => {
    it('should render a data table with breakdown rows', () => {
      createAndFlush();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);
    });

    it('should display Euro 95 and Diesel labels', () => {
      createAndFlush();
      const el = fixture.nativeElement.textContent;
      expect(el).toContain('Euro 95');
      expect(el).toContain('Diesel');
    });
  });

  describe('canvas a11y', () => {
    it('should have canvas with aria-label', () => {
      createAndFlush();
      const canvas = fixture.nativeElement.querySelector('canvas');
      expect(canvas?.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have role="img" on canvas', () => {
      createAndFlush();
      const canvas = fixture.nativeElement.querySelector('canvas');
      expect(canvas?.getAttribute('role')).toBe('img');
    });
  });

  describe('derived fallback', () => {
    it('should always show derived note (all breakdowns are estimated)', () => {
      createAndFlush();
      const el = fixture.nativeElement.textContent;
      expect(el).toContain('Estimated from reference rates');
    });
  });

  describe('loading state', () => {
    it('should show skeleton while loading', () => {
      fixture = TestBed.createComponent(TaxBreakdownComponent);
      fixture.detectChanges();
      const skeleton = fixture.nativeElement.querySelector('app-skeleton-loader');
      expect(skeleton).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('should show error on failed request', () => {
      fixture = TestBed.createComponent(TaxBreakdownComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('[translated] Tax error');
    });
  });
});
