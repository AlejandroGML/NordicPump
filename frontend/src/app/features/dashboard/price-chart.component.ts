import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Chart } from 'chart.js';
import { SkeletonLoaderComponent } from '@shared/skeleton-loader/skeleton-loader.component';
import { TablePaginatorComponent } from '@shared/table-paginator/table-paginator.component';
import { ErrorStateComponent } from '@shared/error-state/error-state.component';
import { BaseChartComponent } from '@shared/base-chart/base-chart.component';
import { formatEur, formatNative, formatSek } from '@shared/formatters/currency';
import { parseDateUtc } from '@shared/formatters/date';
import { type Country } from '@core/services/country-state.service';
import { PriceRecord } from '@shared/models/price';

/** Chart.js easing string union workaround. */
type ChartEasing = 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' |
  'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInQuart' |
  'easeOutQuart' | 'easeInOutQuart' | 'easeInQuint' | 'easeOutQuint' |
  'easeInOutQuint' | 'easeInSine' | 'easeOutSine' | 'easeInOutSine' |
  'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo' | 'easeInCirc' |
  'easeOutCirc' | 'easeInOutCirc' | 'easeInElastic' | 'easeOutElastic' |
  'easeInOutElastic' | 'easeInBack' | 'easeOutBack' | 'easeInOutBack' |
  'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';

/**
 * Historical price chart for the selected Nordic country.
 *
 * Spec: price-chart
 * - Fetches GET /api/v1/prices/{country} on country change
 * - Renders line chart with Chart.js (Euro 95 + Diesel as separate series)
 * - 600ms draw-in animation, respects prefers-reduced-motion
 * - Pattern overlay for colorblind accessibility
 * - Accessible data table below canvas with pagination (10 rows per page)
 * - Loading skeleton, error state with Retry
 */
@Component({
  selector: 'app-price-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonLoaderComponent, TablePaginatorComponent, ErrorStateComponent],
  template: `
    <div class="chart-container">
      @if (loading()) {
        <app-skeleton-loader variant="card" [attr.aria-busy]="true" label="Rendering chart..." />
      } @else if (errorKey()) {
        <app-error-state
          [message]="errorMessage ?? ''"
          [retryLabel]="translate.instant('dashboard.price.retry')"
          (retry)="loadPrices(priceData.country())"
        />
      } @else if (prices().length > 0) {
        <div class="canvas-wrapper relative" style="height: 300px;">
          <canvas #chartCanvas
            role="img"
            [attr.aria-label]="i18n['chartTitle']"
            [attr.aria-describedby]="'price-table'"
          ></canvas>
        </div>
        <table id="price-table" class="w-full mt-4 text-body-sm border-collapse overflow-x-auto block sm:table">
          <caption class="text-left text-text font-semibold mb-2">
            {{ i18n['chartTitle'] }}
          </caption>
          <thead>
            <tr class="border-b border-hairline">
              <th scope="col" class="text-left py-2 px-3">{{ i18n['dateColumn'] }}</th>
              <th scope="col" class="text-left py-2 px-3">{{ i18n['fuel'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['nativeColumn'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['eurColumn'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['sekColumn'] }}</th>
            </tr>
          </thead>
          <tbody>
            @for (record of paginatedPrices(); track record.date + record.fuel) {
              <tr class="border-b border-hairline hover:bg-surface-muted">
                <td class="py-2 px-3 font-mono tabular-nums">{{ formatDate(record.date) }}</td>
                <td class="py-2 px-3">{{ fuelLabel(record.fuel) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ formatNativePrice(record) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">€{{ formatEur(record.price_eur) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ formatSek(record.price_sek) }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (totalPages() > 1) {
          <app-table-paginator
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            (pageChange)="onPageChange($event)"
          />
        }
      } @else {
        <p class="text-text-muted text-body-sm p-4">{{ i18n['noData'] }}</p>
      }
    </div>
  `,
})
export class PriceChartComponent extends BaseChartComponent {
  protected readonly prices = signal<PriceRecord[]>([]);

  protected readonly pageSize = 10;
  protected readonly currentPage = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.prices().length / this.pageSize)),
  );

  protected readonly paginatedPrices = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.prices().slice(start, start + this.pageSize);
  });

  protected refreshI18n(): void {
    this.i18n['chartTitle'] = this.translate.instant('dashboard.price.chartTitle');
    this.i18n['dateColumn'] = this.translate.instant('dashboard.price.dateColumn');
    this.i18n['fuel'] = this.translate.instant('dashboard.price.fuel');
    this.i18n['priceColumn'] = this.translate.instant('dashboard.price.priceColumn');
    this.i18n['nativeColumn'] = this.translate.instant('dashboard.price.nativeColumn');
    this.i18n['eurColumn'] = this.translate.instant('dashboard.price.eurColumn');
    this.i18n['sekColumn'] = this.translate.instant('dashboard.price.sekColumn');
    this.i18n['noData'] = this.translate.instant('dashboard.price.noData');
  }

  protected renderIfData(): void {
    if (this.prices().length > 0) {
      this.renderChart(this.prices());
    }
  }

  protected onCountryChange(country: Country): void {
    this.loadPrices(country);
  }

  loadPrices(country: Country): void {
    this.startLoading();
    this.prices.set([]);
    this.currentPage.set(1);

    this.priceData.getPrices(country).subscribe({
      next: (response) => {
        this.prices.set(response.prices);
        this.loading.set(false);
        this.scheduleRender(() => this.renderChart(response.prices));
      },
      error: () => {
        this.errorKey.set('dashboard.price.error');
        this.loading.set(false);
      },
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  private renderChart(prices: PriceRecord[]): void {
    if (this.destroyed) return;
    const canvasEl = this.chartCanvas()?.nativeElement;
    if (!canvasEl) return;

    const animation = this.chartConfig.getAnimationConfig();
    const dates = [...new Set(prices.map((p) => p.date))].sort();

    const euro95Map = new Map<string, number>();
    const dieselMap = new Map<string, number>();
    for (const p of prices) {
      if (p.fuel === 'euro_95') euro95Map.set(p.date, this.currency.convert(p.price_eur));
      else if (p.fuel === 'diesel') dieselMap.set(p.date, this.currency.convert(p.price_eur));
    }

    const euro95Data = dates.map((date) => euro95Map.get(date) ?? null);
    const dieselData = dates.map((date) => dieselMap.get(date) ?? null);

    this.chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: this.translate.instant('dashboard.price.euro95'),
            data: euro95Data,
            borderColor: this.chartConfig.colors.low,
            backgroundColor: this.chartConfig.colors.low + '30',
            tension: 0.3,
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [],
            spanGaps: true,
          },
          {
            label: this.translate.instant('dashboard.price.diesel'),
            data: dieselData,
            borderColor: this.chartConfig.colors.high,
            backgroundColor: this.chartConfig.colors.high + '30',
            tension: 0.3,
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [6, 3],
            spanGaps: true,
          },
        ],
      },
      options: {
        animation: {
          duration: animation.duration,
          easing: animation.easing as ChartEasing,
        },
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 16 },
          },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            title: { display: true, text: this.currency.currency() },
            beginAtZero: false,
          },
        },
      },
    });
  }

  protected fuelLabel(fuel: string): string {
    return fuel === 'euro_95'
      ? this.translate.instant('dashboard.price.euro95')
      : this.translate.instant('dashboard.price.diesel');
  }

  protected formatEur = formatEur;

  /** Native price with its currency symbol (e.g. "15,90 SEK" / "222,87 ISK"). */
  protected formatNativePrice(record: PriceRecord): string {
    return formatNative(record.price_native, record.price_native_currency);
  }

  /** SEK price with "kr" suffix, sv-SE formatting. */
  protected formatSek(priceSek: number): string {
    return formatSek(priceSek);
  }

  protected formatDate(dateStr: string): string {
    const d = parseDateUtc(dateStr);
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}
