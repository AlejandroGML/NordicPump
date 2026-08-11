import { Directive, effect, inject, OnInit, OnDestroy, ElementRef, signal, viewChild } from '@angular/core';
import { Chart } from 'chart.js';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { type Country } from '@core/services/country-state.service';
import { ChartConfigService } from '../chart-config/chart-config.service';
import { ThemeService } from '@core/services/theme.service';
import { PriceDataHost } from '@core/services/price-data-host.service';
import { CurrencyService } from '@core/services/currency.service';

/**
 * Abstract base for dashboard chart components.
 *
 * Encapsulates the shared lifecycle boilerplate that was duplicated across
 * PriceChart, NeighborCompare, TaxBreakdown, and SeasonalityChart:
 *   - Chart.js canvas reference, instance, and cleanup
 *   - Loading / error signals
 *   - i18n refresh on language change
 *   - Country-change effect trigger
 *   - Render scheduling with destroyed guard
 *
 * Subclasses must implement:
 *   - refreshI18n()      — populate i18n keys
 *   - onLanguageChange() — re-render chart if data exists
 *   - onCountryChange()  — load data for the new country
 */
@Directive()
export abstract class BaseChartComponent implements OnInit, OnDestroy {
  protected readonly translate = inject(TranslateService);
  protected readonly chartConfig = inject(ChartConfigService);
  readonly priceData = inject(PriceDataHost);
  protected readonly currency = inject(CurrencyService);
  protected readonly themeService = inject(ThemeService);

  protected readonly loading = signal(true);
  protected readonly errorKey = signal<string | null>(null);

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected chart: Chart | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  protected destroyed = false;
  private langSub?: Subscription;

  protected readonly i18n: Record<string, string> = {};

  /** Resolves the error key reactively so language switches update immediately. */
  protected get errorMessage(): string | null {
    const key = this.errorKey();
    return key ? this.translate.instant(key) : null;
  }

  constructor() {
    this.chartConfig.applyDefaults();
    this.refreshI18n();
    effect(() => {
      this.onCountryChange(this.priceData.country());
    });
    // Re-render charts when the display currency changes (destroy first to
    // avoid Chart.js "canvas already in use" — same path as language change).
    effect(() => {
      this.currency.currency();
      this.onLanguageChange();
    });
    // Re-render charts when the theme changes so chart colors follow the
    // CSS variables (ChartConfigService reads them live) — prototype behavior.
    effect(() => {
      this.themeService.theme();
      this.onLanguageChange();
    });
  }

  /**
   * Subscribe to language changes here, not in the constructor: subclass
   * signal fields are initialized only after the base constructor returns,
   * so a synchronous onLangChange emission would hit uninitialized fields.
   */
  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.refreshI18n();
      this.onLanguageChange();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.langSub?.unsubscribe();
    this.chart?.destroy();
  }

  // ── Shared helpers ──────────────────────────────────────────────────────

  /** Destroy any existing chart instance and reset to null. */
  protected destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  /** Reset to loading state: destroy chart, set loading, clear error. */
  protected startLoading(): void {
    this.destroyChart();
    this.loading.set(true);
    this.errorKey.set(null);
  }

  /** Schedule a render callback on next tick, guarded by destroyed flag.
   *  Clears any pending render first: loadPrices may be called multiple
   *  times in quick succession (country effect + currency effect), and
   *  each pending render would recreate the Chart on the same canvas.
   *  Also destroys any existing chart before re-rendering — Chart.js
   *  cannot reuse a canvas that already has a chart instance. */
  protected scheduleRender(fn: () => void): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.destroyChart();
        fn();
      }
    });
  }

  // ── Abstract hooks ─────────────────────────────────────────────────────

  /** Populate i18n keys from the translator. Called on init and language change. */
  protected abstract refreshI18n(): void;

  /**
   * Called when the UI language changes.
   * Destroys the existing chart BEFORE re-rendering to avoid Chart.js
   * "Canvas is already in use" errors, then lets subclasses re-render
   * via {@link renderIfData}.
   */
  protected onLanguageChange(): void {
    this.destroyChart();
    this.renderIfData();
  }

  /** Re-render the chart when language changes AND data is available. */
  protected abstract renderIfData(): void;

  /** Called when the selected country changes — typically loads new data. */
  protected abstract onCountryChange(country: Country): void;
}
