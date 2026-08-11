import { Component, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { type Country } from '@core/services/country-state.service';
import { PriceDataHost } from '@core/services/price-data-host.service';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { CurrencyService } from '@core/services/currency.service';
import { CACHE_TIMESTAMP_KEY } from '../constants/cache-keys';
import { formatDateLocalized } from '../formatters/date';
import { ChartConfigService } from '../chart-config/chart-config.service';

import { PriceRecord } from '../models/price';

/**
 * Displays current Euro 95 and Diesel prices for selected country.
 *
 * Spec: dashboard-core > price-current
 * - Fetches GET /api/v1/prices/{country} on country change
 * - Shows prices in the active currency
 * - Loading: skeleton loader placeholders
 * - Error: translated message + retry button
 * - Trend indicator (percentage) comparing current to previous price:
 *   green ↘ when the price dropped, red ↗ when it rose (prototype: nordicpump-redesign.html)
 * - aria-live="polite" for screen readers
 */
@Component({
  selector: 'app-price-current',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonLoaderComponent, KpiCardComponent],
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .update-card {
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 17px;
      min-height: 142px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .update-card .label { color: var(--color-text-muted); font-size: 12px; }
    .update-card .time { margin: 8px 0 4px; font: 700 24px/1 'Fira Code', monospace; }
    .update-card .meta { color: var(--color-text-subtle); font-size: 11px; }
    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 680px) { .kpi-grid { grid-template-columns: 1fr; } }
  `],
  template: `
    <div aria-live="polite" [attr.aria-busy]="loading()">
      @if (loading()) {
        <div class="kpi-grid">
          <app-skeleton-loader variant="card" label="Loading price data..." />
          <app-skeleton-loader variant="card" label="Loading price data..." />
        </div>
      } @else if (errorKey()) {
        <div class="flex flex-col items-center gap-3 p-8 bg-surface border border-hairline rounded-lg text-center">
          <p class="text-text-muted text-body-sm">{{ errorMessage }}</p>
          <button
            (click)="loadPrices(priceData.country())"
            class="px-4 py-2 bg-primary text-on-primary rounded-md text-body-sm cursor-pointer hover:bg-primary-hover transition-colors min-w-[44px] min-h-[44px]"
          >
            {{ translate.instant('dashboard.price.retry') }}
          </button>
        </div>
      } @else {
        <div class="kpi-grid">
          @for (record of prices(); track record.fuel) {
            <app-kpi-card
              [title]="fuelLabel(record.fuel)"
              [value]="currency.format(record.price_eur)"
              [subtitle]="translate.instant('dashboard.price.perLiter')"
              [trend]="getTrend(record.fuel)"
              [trendDelta]="getTrendPct(record.fuel)"
              [colorBand]="getColorBand(record.price_eur)"
            />
          }
          @if (updatedDate(); as dateStr) {
            <div class="update-card">
              <span class="label">{{ updatedLabel }}</span>
              <div class="time">{{ formattedDate }}</div>
              <span class="meta">{{ updatedMeta }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PriceCurrentComponent {
  readonly priceData = inject(PriceDataHost);
  protected readonly translate = inject(TranslateService);
  private readonly chartConfig = inject(ChartConfigService);
  protected readonly currency = inject(CurrencyService);

  protected readonly prices = signal<PriceRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly updatedDate = signal<string | null>(null);

  /** Resolves the error key reactively so language switches update immediately. */
  protected get errorMessage(): string | null {
    const key = this.errorKey();
    return key ? this.translate.instant(key) : null;
  }

  protected get updatedLabel(): string {
    return this.translate.instant('dashboard.current.updatedLabel');
  }

  protected get updatedMeta(): string {
    return this.translate.instant('dashboard.current.updatedMeta');
  }

  /** Updated-date formatted in the ACTIVE UI language (not hardcoded English).
   *  currentLang is a Signal in ngx-translate v18 but a plain string in
   *  test mocks — handle both. */
  protected get formattedDate(): string | null {
    const raw = this.updatedDate();
    if (!raw) return null;
    const lang = typeof this.translate.currentLang === 'function'
      ? this.translate.currentLang()
      : this.translate.currentLang;
    return formatDateLocalized(raw, lang as string | undefined);
  }

  /** Per-fuel trend: direction + percentage change for display. */
  protected readonly trends = signal<Record<string, { direction: 'up' | 'down'; pct: string }>>({});

  constructor() {
    // React to country changes (initial load happens on first change detection)
    effect(() => {
      const country = this.priceData.country();
      this.loadPrices(country);
    });
  }

  loadPrices(country: Country): void {
    this.loading.set(true);
    this.errorKey.set(null);
    this.prices.set([]);

    this.priceData.getPrices(country).subscribe({
      next: (response) => {
        // Keep only the most recent price per fuel type.
        // Records are already sorted by date descending from the backend.
        const seen = new Set<string>();
        const latest = response.prices.filter((p) => {
          if (seen.has(p.fuel)) return false;
          seen.add(p.fuel);
          return true;
        });
        this.computeTrends(response.prices);
        this.prices.set(latest);
        this.loading.set(false);
        // Extract date from first price record for "Updated:" badge.
        // Stored RAW; formatted per-language in the template getter so the
        // date follows the active UI language (prototype behavior).
        if (response.prices.length > 0) {
          this.updatedDate.set(response.prices[0].date);
        }
        sessionStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
      },
      error: () => {
        this.errorKey.set('dashboard.price.error');
        this.loading.set(false);
      },
    });
  }

  /** Compare the latest snapshot with the previous one (from API history) and
   *  compute trend directions + percentage change.
   *
   *  The backend returns all cached snapshots (date-descending); the first
   *  record per fuel is the current price, the second is the previous week's
   *  snapshot. This makes the trend visible on FIRST load with real data
   *  (prototype behavior) instead of only after a component reload.
   *
   *  Percentage computed on the EUR base: (new − prev) / prev × 100.
   *  Direction semantics (prototype): price DROP = 'down' (green ↘),
   *  price RISE = 'up' (red ↗). */
  private computeTrends(prices: PriceRecord[]): void {
    const newTrends: Record<string, { direction: 'up' | 'down'; pct: string }> = {};
    const prevByFuel: Record<string, number> = {};

    // First pass: collect the 2nd-most-recent price per fuel (previous snapshot)
    const seenFirst = new Set<string>();
    for (const record of prices) {
      if (!seenFirst.has(record.fuel)) {
        seenFirst.add(record.fuel);
        continue;
      }
      if (prevByFuel[record.fuel] === undefined) {
        prevByFuel[record.fuel] = record.price_eur;
      }
    }

    // Second pass: compute trend for the latest price vs previous snapshot
    const seenLatest = new Set<string>();
    for (const record of prices) {
      if (seenLatest.has(record.fuel)) continue;
      seenLatest.add(record.fuel);

      const prev = prevByFuel[record.fuel];
      if (prev !== undefined && prev > 0) {
        const diff = record.price_eur - prev;
        if (diff !== 0) {
          const pct = (diff / prev) * 100;
          const direction = diff > 0 ? 'up' : 'down';
          const sign = diff > 0 ? '+' : '−';
          const pctFormatted = `${sign}${Math.abs(pct).toFixed(1).replace('.', ',')}%`;
          newTrends[record.fuel] = { direction, pct: pctFormatted };
        }
      }
    }
    this.trends.set(newTrends);
  }

  /** Get trend direction for a fuel, or undefined when no previous data exists. */
  protected getTrend(fuel: string): 'up' | 'down' | undefined {
    return this.trends()[fuel]?.direction;
  }

  /** Get formatted percentage for a fuel's trend (e.g. "−1,2%"). */
  protected getTrendPct(fuel: string): string | undefined {
    return this.trends()[fuel]?.pct;
  }

  /** Map EUR price to color band per DESIGN.md chart semantics. */
  protected getColorBand(priceEur: number): 'low' | 'mid' | 'high' {
    const band = this.chartConfig.bandForPrice(priceEur);
    return band === 'high' ? 'high' : band === 'mid' ? 'mid' : 'low';
  }

  protected fuelLabel(fuel: string): string {
    if (fuel === 'euro_95') return this.translate.instant('dashboard.price.euro95');
    if (fuel === 'diesel') return this.translate.instant('dashboard.price.diesel');
    return fuel;
  }


}
