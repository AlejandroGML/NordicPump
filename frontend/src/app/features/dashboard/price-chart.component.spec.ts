import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { CountryStateService } from '@core/services/country-state.service';
import { PriceChartComponent } from './price-chart.component';

/**
 * Spec: price-chart
 * - Fetches /api/v1/prices/{country} on country change
 * - Renders Chart.js line/bar chart
 * - Has accessible data table below canvas
 * - Loading/error states
 * - Reduced motion disables animations
 * - Canvas has aria-label and aria-describedby
 */

const mockPricesSE = {
  country: 'SE',
  prices: [
    {
      country: 'SE',
      fuel: 'euro_95',
      price_eur: 1.535,
      price_native: 1.535,
      price_native_currency: 'EUR',
      price_sek: 17.65,
      date: '2026-06-22',
      frequency: 'weekly',
    },
    {
      country: 'SE',
      fuel: 'diesel',
      price_eur: 1.702,
      price_native: 1.702,
      price_native_currency: 'EUR',
      price_sek: 19.57,
      date: '2026-06-22',
      frequency: 'weekly',
    },
  ],
};

const mockPricesMulti = {
  country: 'SE',
  prices: [
    {
      country: 'SE',
      fuel: 'euro_95',
      price_eur: 1.500,
      price_native: 1.500,
      price_native_currency: 'EUR',
      price_sek: 17.25,
      date: '2026-06-15',
      frequency: 'weekly',
    },
    {
      country: 'SE',
      fuel: 'euro_95',
      price_eur: 1.535,
      price_native: 1.535,
      price_native_currency: 'EUR',
      price_sek: 17.65,
      date: '2026-06-22',
      frequency: 'weekly',
    },
  ],
};


const currencyMock = {
  currency: () => 'SEK',
  setCurrency: () => {},
  setForLang: () => {},
  convert: (eur: number) => eur * 11.5,
  format: (eur: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(eur * 11.5),
};

describe('PriceChartComponent', () => {
  let fixture: ComponentFixture<PriceChartComponent>;
  let httpMock: HttpTestingController;
  let service: CountryStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceChartComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrencyService, useValue: currencyMock },
        CountryStateService,
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => {
              const translations: Record<string, string> = {
                'dashboard.price.error': '[translated] Price error',
                'dashboard.price.chartTitle': 'Price History',
                'dashboard.price.euro95': 'Euro 95',
                'dashboard.price.diesel': 'Diesel',
                'dashboard.price.dateColumn': 'Date',
                'dashboard.price.fuel': 'Fuel',
                'dashboard.price.priceColumn': 'Price (SEK)',
                'dashboard.price.eurColumn': 'EUR',
                'dashboard.price.noData': 'No data available',
                'dashboard.price.retry': 'Try again',
              };
              return translations[key] ?? key;
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

  function createAndFlush(data = mockPricesSE) {
    fixture = TestBed.createComponent(PriceChartComponent);
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/prices/SE');
    req.flush(data);
    fixture.detectChanges();
  }

  describe('API calls', () => {
    it('should call GET /api/v1/prices/SE on init', () => {
      fixture = TestBed.createComponent(PriceChartComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      expect(req.request.method).toBe('GET');
      req.flush(mockPricesSE);
    });

    it('should fetch new data when country changes', () => {
      createAndFlush();
      service.setCountry('DK');
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/DK');
      expect(req.request.method).toBe('GET');
    });
  });

  describe('data table accessibility', () => {
    it('should render a data table below the canvas', () => {
      createAndFlush();
      const table = fixture.nativeElement.querySelector('table');
      expect(table).toBeTruthy();
    });

    it('should have a table caption', () => {
      createAndFlush();
      const caption = fixture.nativeElement.querySelector('caption');
      expect(caption).toBeTruthy();
    });

    it('should list date and prices in table rows', () => {
      createAndFlush();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);
      const firstRow = rows[0]?.textContent ?? '';
      expect(firstRow).toContain('17,65');
    });

    it('should have scope attributes on table headers', () => {
      createAndFlush();
      const th = fixture.nativeElement.querySelector('th[scope="col"]');
      expect(th).toBeTruthy();
    });
  });

  describe('canvas a11y', () => {
    it('should have aria-label on canvas', () => {
      createAndFlush();
      const canvas = fixture.nativeElement.querySelector('canvas');
      expect(canvas).toBeTruthy();
      expect(canvas?.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have role="img" on canvas', () => {
      createAndFlush();
      const canvas = fixture.nativeElement.querySelector('canvas');
      expect(canvas?.getAttribute('role')).toBe('img');
    });
  });

  describe('loading state', () => {
    it('should show skeleton while loading', () => {
      fixture = TestBed.createComponent(PriceChartComponent);
      fixture.detectChanges();
      const skeleton = fixture.nativeElement.querySelector('app-skeleton-loader');
      expect(skeleton).toBeTruthy();
      httpMock.expectOne('/api/v1/prices/SE').flush(mockPricesSE);
    });
  });

  describe('error state', () => {
    it('should show error message on failed request', () => {
      fixture = TestBed.createComponent(PriceChartComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('[translated] Price error');
    });

    it('should have a Retry button on error', () => {
      fixture = TestBed.createComponent(PriceChartComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('button');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('Try again');
    });
  });
});
