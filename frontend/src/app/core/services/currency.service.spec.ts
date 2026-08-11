import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TranslateService,
          useValue: {
            instant: (k: string) => k,
            currentLang: () => 'fi',
            onLangChange: of({ lang: 'sv' }),
          },
        },
      ],
    }).compileComponents();
    service = TestBed.inject(CurrencyService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/v1/rates').flush({
      base: 'EUR',
      rates: { SEK: 11.5, DKK: 7.45, NOK: 12.0 },
    });
  });

  it('should follow the emitted language (sv → SEK) on construction', () => {
    // The translate mock emits {lang:'sv'} synchronously on subscribe
    expect(service.currency()).toBe('SEK');
  });

  it('should use the CURRENT language (fi → EUR) on first load when no event fires', () => {
    // Constructor reads translate.currentLang before subscribing to onLangChange
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TranslateService,
          useValue: {
            instant: (k: string) => k,
            currentLang: () => 'fi',
            onLangChange: of({}), // no language event emitted on initial load
          },
        },
      ],
    }).compileComponents().then(() => {
      const s2 = TestBed.inject(CurrencyService);
      const mock = TestBed.inject(HttpTestingController);
      mock.expectOne('/api/v1/rates').flush({
        base: 'EUR',
        rates: { SEK: 11.5, DKK: 7.45, NOK: 12.0 },
      });
      expect(s2.currency()).toBe('EUR');
      mock.verify();
    });
  });

  it('should use currentLang sv → SEK on first load (direct load in Swedish)', () => {
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TranslateService,
          useValue: {
            instant: (k: string) => k,
            currentLang: () => 'sv',
            onLangChange: of({}),
          },
        },
      ],
    }).compileComponents().then(() => {
      const s2 = TestBed.inject(CurrencyService);
      const mock = TestBed.inject(HttpTestingController);
      mock.expectOne('/api/v1/rates').flush({
        base: 'EUR',
        rates: { SEK: 11.5, DKK: 7.45, NOK: 12.0 },
      });
      expect(s2.currency()).toBe('SEK');
      mock.verify();
    });
  });

  it('should map sv to SEK on language change', () => {
    service.setForLang('sv');
    expect(service.currency()).toBe('SEK');
  });

  it('should map da/nb to DKK/NOK and fi/en/es to EUR', () => {
    service.setForLang('da');
    expect(service.currency()).toBe('DKK');
    service.setForLang('nb');
    expect(service.currency()).toBe('NOK');
    service.setForLang('fi');
    expect(service.currency()).toBe('EUR');
    service.setForLang('en');
    expect(service.currency()).toBe('EUR');
    service.setForLang('es');
    expect(service.currency()).toBe('EUR');
  });

  it('should convert EUR to active currency using fetched rates', () => {
    service.setForLang('sv'); // SEK, rate 11.5
    expect(service.convert(1.5)).toBeCloseTo(17.25, 2);
    service.setForLang('nb'); // NOK, rate 12
    expect(service.convert(2)).toBeCloseTo(24, 2);
  });

  it('should format prices with the currency symbol', () => {
    service.setForLang('sv');
    expect(service.format(1.5)).toContain('kr');
    service.setForLang('fi'); // EUR
    expect(service.format(1.5)).toContain('€');
  });

  it('should keep fallback rates when rates fetch fails', () => {
    const svc = TestBed.inject(CurrencyService);
    // Rebuild service with failing request
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (k: string) => k, onLangChange: of({ lang: 'sv' }) } },
      ],
    }).compileComponents().then(() => {
      const s2 = TestBed.inject(CurrencyService);
      const mock = TestBed.inject(HttpTestingController);
      mock.expectOne('/api/v1/rates').error(new ProgressEvent('error'));
      s2.setForLang('sv');
      expect(s2.convert(1)).toBeCloseTo(11.5, 2); // fallback SEK
      mock.verify();
      expect(svc).toBeTruthy();
    });
  });
});
