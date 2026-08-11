import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyService } from '@core/services/currency.service';
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from './currencies';

/**
 * Currency selector — badge with active symbol + code dropdown.
 *
 * Design: prototype `.native-select` style, consistent with the circular
 * theme toggle and the header controls. The leading badge shows the ACTIVE
 * currency symbol (kr/€) so the current display currency is visible at a
 * glance; the dropdown switches between SEK/EUR/DKK/NOK.
 *
 * Defaults follow the active language (sv→SEK, da→DKK, nb→NOK,
 * fi/en/es→EUR); manual selection wins until the language changes.
 */
@Component({
  selector: 'app-currency-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="currency-control">
      <span class="currency-badge" aria-hidden="true">{{ activeSymbol }}</span>
      <label class="sr-only" for="currency-select">Select display currency</label>
      <select
        id="currency-select"
        class="currency-select"
        [attr.aria-label]="'Select display currency'"
        (change)="onChange($event)"
      >
        @for (c of currencies; track c) {
          <option [value]="c" [selected]="currencyService.currency() === c">{{ c }}</option>
        }
      </select>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }
    .currency-control {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--color-hairline-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
      min-height: 44px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .currency-control:hover { border-color: var(--color-primary); }
    .currency-control:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 45%, transparent);
    }
    .currency-badge {
      display: grid;
      place-items: center;
      min-width: 30px;
      height: 28px;
      margin-left: 6px;
      padding: 0 7px;
      border-radius: 7px;
      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
      color: var(--color-primary);
      font: 700 13px 'Fira Code', monospace;
    }
    .currency-select {
      appearance: none;
      -webkit-appearance: none;
      border: 0;
      background: transparent;
      color: var(--color-text);
      font: inherit;
      letter-spacing: .02em;
      padding: 0 22px 0 8px;
      min-height: 42px;
      cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%237E93B5' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }
    .currency-select:focus { outline: none; }
  `],
})
export class CurrencySwitcherComponent {
  protected readonly currencyService = inject(CurrencyService);
  protected readonly currencies = CURRENCIES;

  protected get activeSymbol(): string {
    return CURRENCY_SYMBOLS[this.currencyService.currency()];
  }

  protected onChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.currencyService.setCurrency(select.value as Currency);
  }
}
