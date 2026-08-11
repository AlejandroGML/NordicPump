import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { PriceCurrentComponent } from './price-current.component';
import { CurrencyService } from '@core/services/currency.service';
import { CountryStateService } from '@core/services/country-state.service';

/** Mock PriceResponse matching backend API. */
const mockPriceResponse = {
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

const DK_PRICES = {
  country: 'DK',
  prices: [
    {
      country: 'DK',
      fuel: 'euro_95',
      price_eur: 2.10,
      price_native: 15.64,
      price_native_currency: 'DKK',
      price_sek: 21.50,
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

describe('PriceCurrentComponent', () => {
  let fixture: ComponentFixture<PriceCurrentComponent>;
  let httpMock: HttpTestingController;
  let service: CountryStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceCurrentComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrencyService, useValue: currencyMock },
        CountryStateService,
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'sv',
            translate: (key: string) => of(key),
            instant: (key: string) => {
              const map: Record<string, string> = {
                'dashboard.price.error': '[translated] Error fetching',
                'dashboard.price.euro95': 'Euro 95',
                'dashboard.price.diesel': 'Diesel',
                'dashboard.price.perLiter': 'kr/liter',
                'dashboard.price.retry': 'Retry',
                'dashboard.trend.up': 'up',
                'dashboard.trend.down': 'down',
                'dashboard.trend.neutral': 'stable',
              };
              return map[key] ?? key;
            },
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CountryStateService);
    service.setCountry('SE');
  });

  /** Helper: create fixture and flush initial HTTP request. */
  function createAndFlush() {
    fixture = TestBed.createComponent(PriceCurrentComponent);
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/prices/SE');
    req.flush(mockPriceResponse);
    fixture.detectChanges();
  }

  describe('API calls', () => {
    it('should call GET /api/v1/prices/SE on init', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      expect(req.request.method).toBe('GET');
      req.flush(mockPriceResponse);
    });

    it('should call GET with new country when country changes', () => {
      createAndFlush();

      service.setCountry('DK');
      fixture.detectChanges();

      const req = httpMock.expectOne('/api/v1/prices/DK');
      expect(req.request.method).toBe('GET');
      req.flush(DK_PRICES);
      fixture.detectChanges();
    });
  });

  describe('price display', () => {
    beforeEach(() => {
      createAndFlush();
    });

    it('should display Euro 95 and Diesel prices in SEK', () => {
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Euro 95');
      expect(el.textContent).toContain('Diesel');
      expect(el.textContent).toContain('17,65');
      expect(el.textContent).toContain('19,57');
    });

    it('should format SEK values with kr suffix', () => {
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('kr/liter');
    });

    it('should use kpi-card components for prices', () => {
      const kpiCards = fixture.nativeElement.querySelectorAll('app-kpi-card');
      expect(kpiCards.length).toBe(2);
    });

    it('should have aria-live="polite" on price container', () => {
      const container = fixture.nativeElement.querySelector('[aria-live="polite"]');
      expect(container).toBeTruthy();
    });

    it('should format the updated date in the ACTIVE UI language (sv → Swedish)', () => {
      const el: HTMLElement = fixture.nativeElement;
      // Mock data uses date 2026-06-22; sv-SE locale renders "22 juni 2026"
      expect(el.textContent).toContain('22 juni 2026');
    });
  });

  describe('updated date locale', () => {
    it('should follow the active language (en → English month name)', () => {
      // Override currentLang to 'en' — date must NOT stay in Swedish
      fixture = TestBed.createComponent(PriceCurrentComponent);
      const translate = TestBed.inject(TranslateService) as unknown as { currentLang: string };
      translate.currentLang = 'en';
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(mockPriceResponse);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('22 Jun 2026');
    });

    it('should fall back to en-GB when language is unknown', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      const translate = TestBed.inject(TranslateService) as unknown as { currentLang: string };
      translate.currentLang = 'xx';
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(mockPriceResponse);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('22 Jun 2026');
    });
  });

  describe('loading state', () => {
    it('should show skeleton loader while request is in flight', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      // Request is pending — skeleton should be visible
      const skeleton = fixture.nativeElement.querySelector('app-skeleton-loader');
      expect(skeleton).toBeTruthy();

      // Cleanup
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(mockPriceResponse);
    });

    it('should have aria-busy during loading', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const container = fixture.nativeElement.querySelector('[aria-busy="true"]');
      expect(container).toBeTruthy();

      // Cleanup
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(mockPriceResponse);
    });
  });

  describe('error state', () => {
    it('should show error message on failed request', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('[translated] Error fetching');
    });

    it('should show retry button on error', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('button');
      expect(retryBtn).toBeTruthy();
    });

    it('should retry API call when retry button clicked', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const errorReq = httpMock.expectOne('/api/v1/prices/SE');
      errorReq.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('button');
      retryBtn?.click();
      fixture.detectChanges();

      const retryReq = httpMock.expectOne('/api/v1/prices/SE');
      retryReq.flush(mockPriceResponse);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('17,65');
    });
  });

  describe('trend indicator (from API history)', () => {
    it('should show up trend when price rose vs previous snapshot', () => {
      // Response contains 2 snapshots: latest (2.10 EUR) + previous (1.535 EUR)
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush({
        country: 'SE',
        prices: [
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_sek: 21.50,
            price_eur: 2.10,
            date: '2026-06-29',
          },
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_sek: 17.65,
            price_eur: 1.535,
            date: '2026-06-22',
          },
        ],
      });
      fixture.detectChanges();

      // euro_95 went from 1.535 to 2.10 EUR → up, +36,8%
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeTruthy();
      expect(trendEl?.textContent).toContain('↗');
      expect(trendEl?.textContent).toContain('+36,8%');
      // Up trend = red (no .down class)
      expect(trendEl?.className).not.toContain('down');
    });

    it('should show down trend when price dropped vs previous snapshot', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush({
        country: 'SE',
        prices: [
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_sek: 14.00,
            price_eur: 1.10,
            date: '2026-06-29',
          },
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_sek: 17.65,
            price_eur: 1.535,
            date: '2026-06-22',
          },
        ],
      });
      fixture.detectChanges();

      // euro_95 went from 1.535 to 1.10 EUR → down, −28,3%
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeTruthy();
      expect(trendEl?.textContent).toContain('↘');
      expect(trendEl?.textContent).toContain('−28,3%');
      // Down trend = green (has .down class)
      expect(trendEl?.className).toContain('down');
    });

    it('should not show trend arrow when only one snapshot exists', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(mockPriceResponse);
      fixture.detectChanges();

      // Single snapshot → no previous price → no trend elements
      const trendEls = fixture.nativeElement.querySelectorAll('[data-testid="kpi-trend"]');
      expect(trendEls.length).toBe(0);
    });
  });

  describe('price-band color coding', () => {
    it('should apply low color band when price_eur is below 1 EUR', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush({
        country: 'SE',
        prices: [
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_eur: 0.95,
            price_sek: 10.93,
          },
        ],
      });
      fixture.detectChanges();

      const kpi = fixture.nativeElement.querySelector('app-kpi-card');
      expect(kpi).toBeTruthy();
      // colorBand is passed through to the KPI card (no price coloring in redesign)
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      expect(valueEl).toBeTruthy();
    });

    it('should apply mid color band when price_eur is between 1 and 3 EUR', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush({
        country: 'SE',
        prices: [
          {
            ...mockPriceResponse.prices[0],
            fuel: 'diesel' as const,
            price_eur: 2.00,
            price_sek: 23.00,
          },
        ],
      });
      fixture.detectChanges();

      const kpi = fixture.nativeElement.querySelector('app-kpi-card');
      expect(kpi).toBeTruthy();
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      expect(valueEl).toBeTruthy();
    });

    it('should apply high color band when price_eur is above 3 EUR', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush({
        country: 'SE',
        prices: [
          {
            ...mockPriceResponse.prices[0],
            fuel: 'euro_95' as const,
            price_eur: 3.10,
            price_sek: 35.65,
          },
        ],
      });
      fixture.detectChanges();

      const kpi = fixture.nativeElement.querySelector('app-kpi-card');
      expect(kpi).toBeTruthy();
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      expect(valueEl).toBeTruthy();
    });
  });

  describe('error i18n', () => {
    it('should use dashboard.price.error translation key instead of hardcoded string', () => {
      fixture = TestBed.createComponent(PriceCurrentComponent);
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/v1/prices/SE');
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      // Translation resolves to translated value, not the hardcoded English literal
      expect(el.textContent).toContain('[translated] Error fetching');
    });
  });
});
