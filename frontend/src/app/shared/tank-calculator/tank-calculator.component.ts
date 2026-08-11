import { Component, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { type Country } from '@core/services/country-state.service';
import { PriceDataHost } from '@core/services/price-data-host.service';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { TankCalculatorService, TANK_MIN, TANK_MAX } from './tank-calculator.service';
import { CurrencyService } from '@core/services/currency.service';

/**
 * Tank Calculator — estimates fill cost for adjustable tank size.
 *
 * Spec: dashboard-core > tank-calculator
 * - Adjustable tank size via slider (1-200L) + synced number input
 * - Fetches prices from /api/v1/prices/{selectedCountry}
 * - Multiplies price_sek × tank liters for SEK totals
 * - Shows native currency totals
 * - Computes fuel savings delta
 * - Loading: SkeletonLoader, Error: message + retry, Empty: no-data message
 * - aria-live="polite", slider aria-valuemin/max/now
 * - 44px touch targets, Nordic minimalist card design
 * - Responsive: single column mobile, two-column desktop
 *
 * Pure view: all computation lives in TankCalculatorService.
 */
@Component({
  selector: 'app-tank-calculator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonLoaderComponent],
  styles: [`
    :host { display: block; height: 100%; }
    .calc {
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 18px;
      height: 100%;
    }
    .calc h3 { font-size: 20px; line-height: 1.2; letter-spacing: -.02em; color: var(--color-text); margin: 0 0 16px; }
    .calc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin: 16px 0 10px;
      color: var(--color-text-muted);
      font-size: 13px;
    }
    .calc-value { font: 700 22px 'Fira Code', monospace; color: var(--color-text); }
    input[type="range"] { width: 100%; accent-color: var(--color-primary); min-height: 44px; }
    .range-labels {
      display: flex;
      justify-content: space-between;
      color: var(--color-text-subtle);
      font: 11px 'Fira Code', monospace;
    }
    .cost-result {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 24px;
      border-top: 1px solid var(--color-hairline);
      padding-top: 18px;
    }
    .liters-control {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .savings-value {
      font: 700 26px 'Fira Code', monospace;
      margin-left: auto;
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
    }
    .savings-value.positive { color: var(--color-chart-low); }
    .savings-value.negative { color: var(--color-chart-high); }
    .savings-sign { font-size: 18px; }
    .cost-result .label {
      color: var(--color-text-muted);
      font-size: 12px;
      max-width: 45%;      /* allow label room so it never crowds the value */
      line-height: 1.4;
    }
    .number-input {
      width: 72px; padding: 0 10px; min-height: 44px;
      background: var(--color-surface);
      border: 1px solid var(--color-hairline-strong);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font: 500 15px 'Fira Code', monospace;
      text-align: center;
    }
    .tank-controls-spacer { height: 24px; }
    .calc .grid { margin-top: 8px; }
    .calc .grid > div { padding-top: 6px; }
    .primary-btn {
      min-height: 44px; border: 0; border-radius: var(--radius-sm);
      background: var(--color-primary); color: var(--color-on-primary);
      padding: 0 15px; font-weight: 700; cursor: pointer;
      box-shadow: 0 5px 12px color-mix(in srgb, var(--color-primary) 28%, transparent);
    }
  `],
  template: `
    <div class="calc">
      <h3>{{ tTitle }}</h3>

      <!-- Tank size controls -->
      <div class="tank-controls">
        <div class="calc-row">
          <label [for]="inputId">{{ tLiters }}</label>
          <div class="liters-control">
            <output class="calc-value" [id]="inputId + '-value'" [for]="inputId" aria-live="polite">{{ calc.tankLiters() }} L</output>
            <input
              [id]="inputId"
              type="number"
              [min]="TANK_MIN"
              [max]="TANK_MAX"
              [value]="calc.tankLiters()"
              class="number-input"
              [attr.aria-label]="tInputLabel"
              (input)="onNumberInput($event)"
              (blur)="onNumberBlur($event)"
            />
          </div>
        </div>
        <input
          #slider
          type="range"
          [min]="TANK_MIN"
          [max]="TANK_MAX"
          step="1"
          [value]="calc.tankLiters()"
          [attr.aria-valuemin]="TANK_MIN"
          [attr.aria-valuemax]="TANK_MAX"
          [attr.aria-valuenow]="calc.tankLiters()"
          [attr.aria-label]="tInputLabel"
          (input)="onSliderInput($event)"
        />
        <div class="range-labels">
          <span>{{ TANK_MIN }} L</span>
          <span>{{ TANK_MAX }} L</span>
        </div>
      </div>

      <!-- Content region: loading / error / empty / calculated -->
      <div class="tank-controls-spacer" aria-hidden="true"></div>
      <div aria-live="polite" [attr.aria-busy]="loading() || null">
        @if (loading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <app-skeleton-loader variant="card" label="Loading tank cost..." />
            <app-skeleton-loader variant="card" label="Loading tank cost..." />
          </div>
        } @else if (errorKey()) {
          <div class="flex flex-col items-center gap-3 p-8 bg-surface border border-hairline rounded-lg text-center">
            <p class="text-text-muted text-body-sm">{{ errorMessage }}</p>
            <button
              (click)="loadPrices(priceData.country())"
              class="primary-btn"
            >
              {{ tRetry }}
            </button>
          </div>
        } @else if (calc.prices().length === 0) {
          <div class="flex flex-col items-center gap-3 p-8 bg-surface border border-hairline rounded-lg text-center">
            <p class="text-text-muted text-body-sm">{{ tNoPrice }}</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Euro 95 -->
            @if (calc.euro95Price(); as p) {
              <div class="bg-surface border border-hairline rounded-lg p-4">
                <p class="text-body-sm text-text-subtle mb-1">{{ tEuro95 }}</p>
                <p class="font-mono text-display text-text m-0">
                  {{ currency.format(calc.euro95CostEur()) }}
                </p>
                <p class="text-caption text-text-muted mt-1 font-mono">
                  {{ tCostValue(calc.euro95CostEur()) }}
                </p>
              </div>
            }

            <!-- Diesel -->
            @if (calc.dieselPrice(); as p) {
              <div class="bg-surface border border-hairline rounded-lg p-4">
                <p class="text-body-sm text-text-subtle mb-1">{{ tDiesel }}</p>
                <p class="font-mono text-display text-text m-0">
                  {{ currency.format(calc.dieselCostEur()) }}
                </p>
                <p class="text-caption text-text-muted mt-1 font-mono">
                  {{ tCostValue(calc.dieselCostEur()) }}
                </p>
              </div>
            }
          </div>

          <!-- Euro 95 vs Diesel difference (no update button — cost is live) -->
          @if (calc.euro95Price() && calc.dieselPrice()) {
            <div class="cost-result">
              <span class="label">{{ tSavingsLabel }}</span>
              <span class="savings-value" [class.positive]="calc.savingsAmount() >= 0" [class.negative]="calc.savingsAmount() < 0">
                <span class="savings-sign" aria-hidden="true">{{ calc.savingsAmount() >= 0 ? '−' : '+' }}</span>
                {{ currency.format(Math.abs(calc.savingsAmount())) }}
              </span>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class TankCalculatorComponent {
  readonly priceData = inject(PriceDataHost);
  readonly calc = inject(TankCalculatorService);
  protected readonly currency = inject(CurrencyService);
  private readonly t = inject(TranslateService);

  protected readonly TANK_MIN = TANK_MIN;
  protected readonly TANK_MAX = TANK_MAX;
  protected readonly Math = Math;

  /** Random ID for label/input association. */
  protected readonly inputId = 'tank-liters-input-' + Math.random().toString(36).slice(2, 9);

  protected readonly loading = signal(true);
  protected readonly errorKey = signal<string | null>(null);

  /** Resolves the error key reactively so language switches update immediately. */
  protected get errorMessage(): string | null {
    const key = this.errorKey();
    return key ? this.t.instant(key) : null;
  }

  // ─── Translated labels (cached in template via getter-style) ────────────

  protected get tTitle(): string { return this.t.instant('dashboard.tank.title'); }
  protected get tLiters(): string { return this.t.instant('dashboard.tank.liters'); }
  protected get tInputLabel(): string { return this.t.instant('dashboard.tank.inputLabel'); }
  protected get tRetry(): string { return this.t.instant('dashboard.tank.retry'); }
  protected get tNoPrice(): string { return this.t.instant('dashboard.tank.noPrice'); }
  protected get tNoSaving(): string { return this.t.instant('dashboard.tank.noSaving'); }
  protected get tEuro95(): string { return this.t.instant('dashboard.price.euro95'); }
  protected get tDiesel(): string { return this.t.instant('dashboard.price.diesel'); }
  protected get tSavingsLabel(): string { return this.t.instant('dashboard.tank.savingsLabel'); }

  /** "Filling 50 L costs 1 207,50 kr" — value formatted in the active
   *  display currency (set via the header currency switcher). */
  protected tCostValue(costEur: number): string {
    return this.t.instant('dashboard.tank.costValue', {
      liters: String(this.calc.tankLiters()),
      amount: this.currency.format(costEur),
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const country = this.priceData.country();
      this.loadPrices(country);
    });
  }

  loadPrices(country: Country): void {
    this.loading.set(true);
    this.errorKey.set(null);
    this.calc.setPrices([]);

    this.priceData.getPrices(country).subscribe({
      next: (response) => {
        this.calc.setPrices(response.prices);
        this.loading.set(false);
      },
      error: () => {
        this.errorKey.set('dashboard.tank.error');
        this.loading.set(false);
      },
    });
  }

  // ─── Input handlers ──────────────────────────────────────────────────────

  protected onSliderInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.calc.setTankLiters(Number(target.value));
  }

  protected onNumberInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    if (isNaN(value)) {
      // Reset to last valid value when invalid (non-numeric) char entered
      target.value = String(this.calc.tankLiters());
    } else {
      this.calc.setTankLiters(value);
    }
  }

  protected onNumberBlur(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    if (!isNaN(value)) {
      const clamped = this.calc.clampLiters(value);
      this.calc.tankLiters.set(clamped);
      target.value = String(clamped);
    }
  }

  // ─── Formatting ──────────────────────────────────────────────────────────

}
