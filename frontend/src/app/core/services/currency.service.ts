import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { CURRENCY_LOCALES, type Currency } from '@shared/currency-switcher/currencies';

/** Supported display currencies — generated from countries.json. */
export type { Currency } from '@shared/currency-switcher/currencies';

/** Currency codes per supported language (native currency of the locale). */
const LANG_CURRENCY: Record<string, Currency> = {
  sv: 'SEK',
  da: 'DKK',
  nb: 'NOK',
  fi: 'EUR',
  en: 'EUR',
  es: 'EUR',
  is: 'ISK',
};



/** Fallback rates used until /api/v1/rates responds (mirror backend defaults). */
const FALLBACK_RATES: Record<Currency, number> = {
  EUR: 1,
  SEK: 11.5,
  DKK: 7.45,
  NOK: 12.0,
  ISK: 140.0,
};

interface RatesResponse {
  base: string;
  rates: Partial<Record<Currency, number>>;
}

/**
 * Display currency state and EUR-based conversion.
 *
 * - currency() signal: the active display currency
 * - setForLang(): language → native currency (sv→SEK, da→DKK, nb→NOK, fi/en/es→EUR)
 * - convert(priceEur): price in the active currency
 * - format(priceEur): locale-formatted string with currency symbol
 *
 * Rates are fetched once from GET /api/v1/rates; backend fallbacks are
 * used if the fetch fails (same policy as the backend ingestion).
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);

  readonly currency = signal<Currency>('EUR');
  private readonly rates = signal<Record<Currency, number>>(FALLBACK_RATES);

  constructor() {
    this.loadRates();
    // Set from the CURRENT language on first load (onLangChange only fires
    // on switches, not for the initial language), then follow future changes.
    // Defensive access: currentLang may be a Signal (prod) or a plain value (test mocks).
    const currentLang = this.translate.currentLang as unknown;
    const initialLang = typeof currentLang === 'function' ? (currentLang as () => string | null)() : (currentLang as string | null);
    if (initialLang) this.setForLang(initialLang);
    this.translate.onLangChange?.subscribe((e) => this.setForLang(e.lang));
  }

  loadRates(): void {
    this.http.get<RatesResponse>('/api/v1/rates').subscribe({
      next: (res) => {
        const merged = { ...FALLBACK_RATES, ...res.rates } as Record<Currency, number>;
        this.rates.set(merged);
      },
      // Keep fallback rates on failure — display still works
      error: () => {},
    });
  }

  setCurrency(c: Currency): void {
    this.currency.set(c);
  }

  /** Set the display currency from a language code (no-op for unknown). */
  setForLang(lang: string): void {
    const c = LANG_CURRENCY[lang];
    if (c) this.currency.set(c);
  }

  /** Convert an EUR price to the active display currency. */
  convert(priceEur: number): number {
    return priceEur * this.rates()[this.currency()];
  }

  /** Format an EUR price in the active currency with symbol. */
  format(priceEur: number): string {
    return new Intl.NumberFormat(CURRENCY_LOCALES[this.currency()], {
      style: 'currency',
      currency: this.currency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.convert(priceEur));
  }
}
