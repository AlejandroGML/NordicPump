import { Component, signal, computed, ChangeDetectionStrategy, ElementRef, inject, viewChildren } from '@angular/core';
import { Chart } from 'chart.js';
import { SkeletonLoaderComponent } from '@shared/skeleton-loader/skeleton-loader.component';
import { TablePaginatorComponent } from '@shared/table-paginator/table-paginator.component';
import { ErrorStateComponent } from '@shared/error-state/error-state.component';
import { BaseChartComponent } from '@shared/base-chart/base-chart.component';
import { formatSek } from '@shared/formatters/currency';
import { type Country } from '@core/services/country-state.service';
import { PriceRecord } from '@shared/models/price';

interface BreakdownRow {
  fuel: string;
  fuelLabel: string;
  product: number;
  excise: number;
  vat: number;
  other: number;
  total: number;
  derived: boolean;
}

/**
 * Doughnut chart decomposing fuel price into components.
 *
 * Spec: tax-breakdown — prototype: nordicpump-redesign.html → #tax-chart
 * - Doughnut (cutout 66%) with 3 segments: Base price (product + other),
 *   VAT, Energy excise — colors primary/vat/mid (prototype tokens)
 * - Derives breakdown from Swedish reference rates (55% product, 25% excise, 20% VAT)
 * - Accessible data table below (product/excise/vat/other detail)
 */
@Component({
  selector: 'app-tax-breakdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonLoaderComponent, TablePaginatorComponent, ErrorStateComponent],
  styles: [`
    .doughnut-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .doughnut-item { min-width: 0; }
    .doughnut-title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
      text-align: center;
    }
    @media (max-width: 680px) {
      .doughnut-grid { grid-template-columns: 1fr; }
    }
  `],
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
      } @else if (breakdown().length > 0) {
        @if (breakdown()[0]?.derived) {
          <p class="text-text-subtle text-caption mb-2 italic">{{ i18n['derivedNote'] }}</p>
        }
        <!-- Two separate doughnuts (one per fuel) so each triad maps
             unambiguously to its fuel — no concentric-ring confusion. -->
        <div class="doughnut-grid">
          @for (item of chartItems(); track item.fuel) {
            <div class="doughnut-item">
              <h4 class="doughnut-title">{{ item.fuelLabel }}</h4>
              <div class="canvas-wrapper relative" style="height: 220px;">
                <canvas
                  #fuelCanvas
                  role="img"
                  [attr.aria-label]="item.fuelLabel + ' — ' + i18n['taxTitle']"
                  [attr.aria-describedby]="'tax-table'"
                ></canvas>
              </div>
            </div>
          }
        </div>
        <table id="tax-table" class="w-full mt-4 text-body-sm border-collapse overflow-x-auto block sm:table">
          <caption class="text-left text-text font-semibold mb-2">
            {{ i18n['taxTitle'] }}
          </caption>
          <thead>
            <tr class="border-b border-hairline">
              <th scope="col" class="text-left py-2 px-3">{{ i18n['fuel'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['product'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['excise'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['vat'] }}</th>
              <th scope="col" class="text-right py-2 px-3">{{ i18n['other'] }}</th>
              <th scope="col" class="text-right py-2 px-3 font-semibold">{{ i18n['total'] }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of paginatedBreakdown(); track row.fuel) {
              <tr class="border-b border-hairline hover:bg-surface-muted">
                <td class="py-2 px-3">{{ row.fuelLabel }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ currency.format(row.product) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ currency.format(row.excise) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ currency.format(row.vat) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums">{{ currency.format(row.other) }}</td>
                <td class="py-2 px-3 text-right font-mono tabular-nums font-semibold">{{ currency.format(row.total) }}</td>
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
export class TaxBreakdownComponent extends BaseChartComponent {
  private readonly elementRef = inject(ElementRef);

  protected readonly breakdown = signal<BreakdownRow[]>([]);

  protected readonly pageSize = 10;
  protected readonly currentPage = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.breakdown().length / this.pageSize)),
  );

  protected readonly paginatedBreakdown = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.breakdown().slice(start, start + this.pageSize);
  });

  protected refreshI18n(): void {
    this.i18n['taxTitle'] = this.translate.instant('dashboard.tax.title');
    this.i18n['base'] = this.translate.instant('dashboard.tax.base');
    this.i18n['product'] = this.translate.instant('dashboard.tax.product');
    this.i18n['excise'] = this.translate.instant('dashboard.tax.excise');
    this.i18n['vat'] = this.translate.instant('dashboard.tax.vat');
    this.i18n['other'] = this.translate.instant('dashboard.tax.other');
    this.i18n['derivedNote'] = this.translate.instant('dashboard.tax.derivedNote');
    this.i18n['noData'] = this.translate.instant('dashboard.tax.noData');
    this.i18n['fuel'] = this.translate.instant('dashboard.tax.fuel');
    this.i18n['total'] = this.translate.instant('dashboard.tax.total');
  }

  protected renderIfData(): void {
    if (this.breakdown().length > 0) {
      this.renderChart(this.breakdown());
    }
  }

  /** Destroy ALL per-fuel charts (BaseChart only knows about the single chart). */
  override destroyChart(): void {
    super.destroyChart();
    for (const chart of this.charts.values()) {
      chart.destroy();
    }
    this.charts.clear();
  }

  protected onCountryChange(country: Country): void {
    this.loadPrices(country);
  }

  loadPrices(country: Country): void {
    this.startLoading();
    this.breakdown.set([]);
    this.currentPage.set(1);

    this.priceData.getPrices(country).subscribe({
      next: (response) => {
        const rows = this.buildBreakdown(response.prices);
        this.breakdown.set(rows);
        this.loading.set(false);
        this.scheduleRender(() => this.renderChart(rows));
      },
      error: () => {
        this.errorKey.set('dashboard.tax.error');
        this.loading.set(false);
      },
    });
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  private buildBreakdown(prices: PriceRecord[]): BreakdownRow[] {
    const fuelTypes = ['euro_95', 'diesel'];

    return fuelTypes
      .map((fuel) => {
        const record = prices.find((p) => p.fuel === fuel);
        if (!record) return null;

        const fuelLabel =
          fuel === 'euro_95'
            ? this.translate.instant('dashboard.price.euro95')
            : this.translate.instant('dashboard.price.diesel');

        // Derived from reference rates (Energimyndigheten), on EUR base
        const price = record.price_eur;
        return {
          fuel,
          fuelLabel,
          product: Math.round(price * 0.55 * 100) / 100,
          excise: Math.round(price * 0.25 * 100) / 100,
          vat: Math.round(price * 0.20 * 100) / 100,
          other: 0,
          total: price,
          derived: true,
        };
      })
      .filter((r): r is BreakdownRow => r !== null);
  }

  /** Per-fuel chart descriptors (fuel + label + triad + data). */
  protected readonly chartItems = computed(() => {
    const triads: Record<string, string[]> = {
      euro_95: [
        this.chartConfig.colors.primary,
        this.chartConfig.colors.sky,
        this.chartConfig.colors.mid,
      ],
      diesel: [
        this.chartConfig.colors.low,
        this.chartConfig.colors.high,
        this.chartConfig.colors.other,
      ],
    };
    return this.breakdown().map((row) => ({
      fuel: row.fuel,
      fuelLabel: row.fuelLabel,
      data: [row.product + row.other, row.excise, row.vat],
      colors: triads[row.fuel] ?? [
        this.chartConfig.colors.primary,
        this.chartConfig.colors.sky,
        this.chartConfig.colors.mid,
      ],
    }));
  });

  /** Chart.js instances per fuel — each doughnut is fully independent. */
  private charts = new Map<string, Chart>();

  private renderChart(rows: BreakdownRow[]): void {
    if (this.destroyed) return;
    const canvasEls = this.fuelCanvases();
    if (canvasEls.length === 0) return;

    const animation = this.chartConfig.getAnimationConfig();
    const labels = [
      this.translate.instant('dashboard.tax.base'),
      this.translate.instant('dashboard.tax.excise'),
      this.translate.instant('dashboard.tax.vat'),
    ];

    rows.forEach((row, index) => {
      const canvasEl = canvasEls[index]?.nativeElement;
      if (!canvasEl) return;

      const triad = this.chartItems().find((c) => c.fuel === row.fuel)?.colors ?? [
        this.chartConfig.colors.primary,
        this.chartConfig.colors.sky,
        this.chartConfig.colors.mid,
      ];

      // Destroy any existing chart on this canvas before re-creating
      // (Chart.js "canvas already in use" guard — BaseChart pattern).
      const existing = this.charts.get(row.fuel);
      if (existing) {
        existing.destroy();
        this.charts.delete(row.fuel);
      }

      const chart = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            label: row.fuelLabel,
            data: [row.product + row.other, row.excise, row.vat],
            backgroundColor: triad,
            borderColor: this.chartConfig.colors.surface,
            borderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            tooltip: { mode: 'index' },
            legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } },
          },
          animation: animation.duration > 0 ? {
            duration: animation.duration,
            easing: 'easeOutQuart',
          } : false,
        },
      });
      this.charts.set(row.fuel, chart);
    });
  }

  /** The fuel canvases rendered by the @for — reactive via Angular viewChildren. */
  protected readonly fuelCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('fuelCanvas');

}
