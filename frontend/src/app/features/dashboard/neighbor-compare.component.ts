import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Chart } from 'chart.js';
import { SkeletonLoaderComponent } from '@shared/skeleton-loader/skeleton-loader.component';
import { TablePaginatorComponent } from '@shared/table-paginator/table-paginator.component';
import { ErrorStateComponent } from '@shared/error-state/error-state.component';
import { BaseChartComponent } from '@shared/base-chart/base-chart.component';
import { formatSek, formatEur, formatNative } from '@shared/formatters/currency';
import { type Country } from '@core/services/country-state.service';
import { PriceResponse } from '@shared/models/price';

interface CountryData {
  country: string;
  label: string;
  priceEur: number;
  priceSek: number;
  priceNative: number;
  nativeCurrency: string;
  available: boolean;
}

const ALL_COUNTRIES: readonly Country[] = ['SE', 'DK', 'FI', 'NO', 'IS'];

/**
 * Horizontal bar chart comparing Euro 95 prices across all 4 Nordic countries.
 *
 * Spec: neighbor-compare
 * - Fetches all 4 countries in parallel (forkJoin)
 * - Horizontal bar chart sorted cheapest→most expensive
 * - Price-band color coding per DESIGN.md
 * - Pattern overlay on bars for colorblind a11y
 * - Accessible data table
 * - Partial failure handling
 */
@Component({
  selector: 'app-neighbor-compare',
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
          (retry)="loadData()"
        />
      } @else if (data().length > 0) {
        <div class="canvas-wrapper relative" style="height: 300px;">
          <canvas #chartCanvas
            role="img"
            [attr.aria-label]="i18n['compareTitle']"
            [attr.aria-describedby]="'compare-table'"
          ></canvas>
        </div>
        <table id="compare-table" class="w-full mt-4 text-body-sm border-collapse overflow-x-auto block sm:table">
          <caption class="text-left text-text font-semibold mb-2">
            {{ i18n['compareTitle'] }}
          </caption>
          <thead>
            <tr class="border-b border-hairline">
              <th scope="col" class="text-left py-2 px-3">{{ i18n['country'] }}</th>
              <th scope="col" class="text-left py-2 px-3">{{ i18n['fuel'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['nativeColumn'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['eurColumn'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['sekColumn'] }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of paginatedData(); track row.country) {
              <tr class="border-b border-hairline hover:bg-surface-muted">
                <td class="py-2 px-3">{{ row.available ? row.label : (row.label + ' — ' + i18n['unavailable']) }}</td>
                <td class="py-2 px-3">{{ i18n['euro95'] }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">
                  {{ row.available ? formatNativePrice(row) : '—' }}
                </td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">
                  {{ row.available ? '€' + formatEur(row.priceEur) : '—' }}
                </td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">
                  {{ row.available ? formatSek(row.priceSek) : '—' }}
                </td>
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
export class NeighborCompareComponent extends BaseChartComponent {
  protected readonly data = signal<CountryData[]>([]);

  protected readonly pageSize = 10;
  protected readonly currentPage = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.data().length / this.pageSize)),
  );

  protected readonly paginatedData = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.data().slice(start, start + this.pageSize);
  });

  protected refreshI18n(): void {
    this.i18n['compareTitle'] = this.translate.instant('dashboard.compare.title');
    this.i18n['country'] = this.translate.instant('dashboard.compare.country');
    this.i18n['fuel'] = this.translate.instant('dashboard.compare.fuel');
    this.i18n['priceSEK'] = this.translate.instant('dashboard.compare.priceSEK');
    this.i18n['nativeColumn'] = this.translate.instant('dashboard.price.nativeColumn');
    this.i18n['sekColumn'] = this.translate.instant('dashboard.price.sekColumn');
    this.i18n['unavailable'] = this.translate.instant('dashboard.compare.unavailable');
    this.i18n['noData'] = this.translate.instant('dashboard.compare.noData');
    this.i18n['euro95'] = this.translate.instant('dashboard.price.euro95');
    this.i18n['eurColumn'] = this.translate.instant('dashboard.price.eurColumn');
  }

  protected renderIfData(): void {
    if (this.data().length > 0) {
      this.renderChart(this.data());
    }
  }

  protected onCountryChange(_country: Country): void {
    this.loadData();
  }

  loadData(): void {
    this.startLoading();
    this.data.set([]);
    this.currentPage.set(1);

    const requests = ALL_COUNTRIES.map((country) =>
      this.priceData.getPrices(country).pipe(
        map((res) => ({ ok: true as const, data: res })),
        catchError(() => of({ ok: false as const, data: { country } as PriceResponse })),
      ),
    );

    forkJoin(requests).subscribe((responses) => {
      const countryData: CountryData[] = responses
        .map((r) => {
          const country = (r.data as PriceResponse).country;
          const euro95 = r.ok ? r.data.prices.find((p) => p.fuel === 'euro_95') : null;
          return {
            country,
            label: this.translate.instant(`dashboard.compare.country${country}`),
            priceEur: euro95?.price_eur ?? 0,
            priceSek: euro95?.price_sek ?? 0,
            priceNative: euro95?.price_native ?? 0,
            nativeCurrency: euro95?.price_native_currency ?? '',
            available: r.ok && !!euro95,
          };
        })
        .sort((a, b) => {
          if (!a.available && !b.available) return 0;
          if (!a.available) return 1;
          if (!b.available) return -1;
          return a.priceSek - b.priceSek;
        });

      const allFailed = countryData.every((c) => !c.available);
      if (allFailed) {
        this.errorKey.set('dashboard.compare.error');
      } else {
        this.data.set(countryData);
      }
      this.loading.set(false);
      if (!allFailed) {
        this.scheduleRender(() => this.renderChart(countryData));
      }
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  private renderChart(countryData: CountryData[]): void {
    if (this.destroyed) return;
    const canvasEl = this.chartCanvas()?.nativeElement;
    if (!canvasEl) return;

    const animation = this.chartConfig.getAnimationConfig();

    const labels = [...countryData].reverse().map((c) => c.label);
    const values = [...countryData].reverse().map((c) => (c.available ? this.currency.convert(c.priceEur) : 0));
    const barColors = [...countryData].reverse().map((c) => this.getCountryColor(c.country, c.available));

    this.chart = new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.currency.currency(),
            data: values,
            backgroundColor: barColors,
            borderColor: barColors,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        animation: {
          duration: animation.duration,
          easing: animation.easing as 'easeOutQuart' | 'linear',
        },
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw} ${this.currency.currency()}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: this.currency.currency() },
            beginAtZero: true,
          },
          y: { grid: { display: false } },
        },
      },
    });
  }

  /** Per-country color — 4 DISTINCT hues (never two similar blues):
   *  SE→primary (royal blue), DK→sky (cyan), FI→low (green), NO→mid (amber).
   *  Unavailable countries get the neutral 'unavailable' color.
   *  Each hue comes from the project palette and differs clearly from the
   *  chart series colors (historical uses low/high, doughnut uses triads). */
  private getCountryColor(country: string, available: boolean): string {
    if (!available) return this.chartConfig.colors.unavailable;
    const map: Record<string, 'primary' | 'sky' | 'low' | 'mid' | 'high'> = {
      SE: 'primary',
      DK: 'sky',
      FI: 'low',
      NO: 'mid',
      IS: 'high',
    };
    return this.chartConfig.colors[map[country] ?? 'sky'];
  }

  protected formatEur = formatEur;

  /** Native price with its currency symbol (e.g. "15,90 SEK" / "222,87 ISK"). */
  protected formatNativePrice(row: CountryData): string {
    return formatNative(row.priceNative, row.nativeCurrency);
  }

  /** SEK price with "kr" suffix, sv-SE formatting. */
  protected formatSek(priceSek: number): string {
    return formatSek(priceSek);
  }
}
