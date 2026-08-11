import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NeighborCompareComponent } from './neighbor-compare.component';
import { CurrencyService } from '@core/services/currency.service';

// Defensive stub — ThemeService (root-injected) calls window.matchMedia in its constructor
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const priceSE = {
  country: 'SE',
  prices: [{ country: 'SE', fuel: 'euro_95', price_eur: 1.53, price_sek: 17.65, price_native: 1.53, price_native_currency: 'EUR', date: '2026-06-22', frequency: 'weekly' }],
};
const priceDK = {
  country: 'DK',
  prices: [{ country: 'DK', fuel: 'euro_95', price_eur: 2.10, price_sek: 21.50, price_native: 15.64, price_native_currency: 'DKK', date: '2026-06-22', frequency: 'weekly' }],
};
const priceFI = {
  country: 'FI',
  prices: [{ country: 'FI', fuel: 'euro_95', price_eur: 1.85, price_sek: 19.20, price_native: 1.85, price_native_currency: 'EUR', date: '2026-06-22', frequency: 'weekly' }],
};
const priceNO = {
  country: 'NO',
  prices: [{ country: 'NO', fuel: 'euro_95', price_eur: 2.25, price_sek: 23.10, price_native: 23.10, price_native_currency: 'NOK', date: '2026-06-22', frequency: 'weekly' }],
};
const priceIS = {
  country: 'IS',
  prices: [{ country: 'IS', fuel: 'euro_95', price_eur: 1.55, price_sek: 17.83, price_native: 221.0, price_native_currency: 'ISK', date: '2026-06-22', frequency: 'weekly' }],
};

/**
 * Spec: neighbor-compare
 * - Fetches all 4 Nordic countries in parallel (forkJoin)
 * - Horizontal bar chart sorted cheapest→most expensive
 * - Price-band color coding
 * - Accessible data table
 * - Partial failure: show available + placeholder for failed
 * - All failure: error + retry
 */

const currencyMock = {
  currency: () => 'SEK',
  setCurrency: () => {},
  setForLang: () => {},
  convert: (eur: number) => eur * 11.5,
  format: (eur: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(eur * 11.5),
};

describe('NeighborCompareComponent', () => {
  let fixture: ComponentFixture<NeighborCompareComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NeighborCompareComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrencyService, useValue: currencyMock },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => {
              const t: Record<string, string> = {
                'dashboard.compare.title': 'Neighbor Comparison',
                'dashboard.compare.error': '[translated] Compare error',
                'dashboard.compare.unavailable': 'Data unavailable',
                'dashboard.compare.noData': 'No data available',
                'dashboard.compare.countrySE': 'Sweden',
                'dashboard.compare.countryDK': 'Denmark',
                'dashboard.compare.countryFI': 'Finland',
                'dashboard.compare.countryNO': 'Norway',
                'dashboard.compare.countryIS': 'Iceland',
                'dashboard.price.euro95': 'Euro 95',
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
  });

  function createAndFlushAll() {
    fixture = TestBed.createComponent(NeighborCompareComponent);
    fixture.detectChanges();

    const calls = ['SE', 'DK', 'FI', 'NO', 'IS'];
    const responses: Record<string, object> = { SE: priceSE, DK: priceDK, FI: priceFI, NO: priceNO, IS: priceIS };

    // Order matches creation order in component
    for (const country of calls) {
      const req = httpMock.expectOne(`/api/v1/prices/${country}`);
      req.flush(responses[country]);
    }
    fixture.detectChanges();
  }

  describe('API calls', () => {
    it('should fetch all 5 countries on init', () => {
      fixture = TestBed.createComponent(NeighborCompareComponent);
      fixture.detectChanges();

      const reqs = httpMock.match(() => true);
      expect(reqs.length).toBe(5);
      const urls = reqs.map(r => r.request.url);
      expect(urls).toContain('/api/v1/prices/SE');
      expect(urls).toContain('/api/v1/prices/DK');
      expect(urls).toContain('/api/v1/prices/FI');
      expect(urls).toContain('/api/v1/prices/NO');
      expect(urls).toContain('/api/v1/prices/IS');
    });
  });

  describe('sorting', () => {
    it('should sort countries from cheapest to most expensive', () => {
      createAndFlushAll();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      const prices = Array.from(rows as NodeListOf<Element>).map(r => r.textContent ?? '');
      // SE (price_sek 17,65) < IS (price_sek 17,83) < FI (19,20)
      // < DK (21,50) < NO (23,10) — the SEK column shows the fixture price_sek
      expect(prices[0]).toContain('17,65');   // SE cheapest
      expect(prices[1]).toContain('17,83');   // IS second
      expect(prices[4]).toContain('23,10');   // NO most expensive
    });
  });

  describe('data table', () => {
    it('should render a table with all 5 countries', () => {
      createAndFlushAll();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
    });

    it('should have country names in table', () => {
      createAndFlushAll();
      const el = fixture.nativeElement.textContent;
      expect(el).toContain('Sweden');
      expect(el).toContain('Denmark');
      expect(el).toContain('Norway');
      expect(el).toContain('Iceland');
    });
  });

  describe('canvas a11y', () => {
    it('should have a canvas with aria-label', () => {
      createAndFlushAll();
      const canvas = fixture.nativeElement.querySelector('canvas');
      expect(canvas?.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('should show skeleton while loading', () => {
      fixture = TestBed.createComponent(NeighborCompareComponent);
      fixture.detectChanges();
      const skeleton = fixture.nativeElement.querySelector('app-skeleton-loader');
      expect(skeleton).toBeTruthy();
    });
  });

  describe('partial failure', () => {
    it('should render 4 available countries when NO fails', () => {
      fixture = TestBed.createComponent(NeighborCompareComponent);
      fixture.detectChanges();

      httpMock.expectOne('/api/v1/prices/SE').flush(priceSE);
      httpMock.expectOne('/api/v1/prices/DK').flush(priceDK);
      httpMock.expectOne('/api/v1/prices/FI').flush(priceFI);
      httpMock.expectOne('/api/v1/prices/NO').flush(null, { status: 503, statusText: 'Service Unavailable' });
      httpMock.expectOne('/api/v1/prices/IS').flush(priceIS);
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Data unavailable');
    });
  });

  describe('error state', () => {
    it('should show error when all APIs fail', () => {
      fixture = TestBed.createComponent(NeighborCompareComponent);
      fixture.detectChanges();

      for (const country of ['SE', 'DK', 'FI', 'NO', 'IS']) {
        httpMock.expectOne(`/api/v1/prices/${country}`).flush(null, { status: 503, statusText: 'Service Unavailable' });
      }
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('[translated] Compare error');
    });
  });
});
