import { Component, HostListener, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CountrySelectorComponent } from '@shared/country-selector/country-selector.component';
import { PriceCurrentComponent } from '@shared/price-current/price-current.component';
import { TankCalculatorComponent } from '@shared/tank-calculator/tank-calculator.component';
import { PriceChartComponent } from './price-chart.component';
import { NeighborCompareComponent } from './neighbor-compare.component';
import { TaxBreakdownComponent } from './tax-breakdown.component';
import { SkeletonLoaderComponent } from '@shared/skeleton-loader/skeleton-loader.component';
import { CountryStateService } from '@core/services/country-state.service';
import { CurrencyService } from '@core/services/currency.service';

/**
 * Dashboard component — NordicPump fuel price dashboard.
 *
 * Layout (nordicpump-redesign.html):
 * - Hero: eyebrow + H1 + description + cache banner
 * - Market section: country tabs + section head
 * - Price KPIs: grid of price cards
 * - Tank calculator (single column, prototype)
 * - Charts: collapsible chart cards (details/summary), 2-col grid
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    CountrySelectorComponent,
    PriceCurrentComponent,
    TankCalculatorComponent,
    PriceChartComponent,
    NeighborCompareComponent,
    TaxBreakdownComponent,
    SkeletonLoaderComponent,
  ],
  styles: [`
    .app-shell { max-width: 1440px; margin: 0 auto; padding: 0 22px 48px; }
    .eyebrow { color: var(--color-text-subtle); text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; }
    .hero { padding: 34px 0 22px; display: flex; justify-content: space-between; gap: 24px; align-items: end; }
    .hero-copy { max-width: 620px; }
    .hero-copy p { margin-top: 10px; color: var(--color-text-muted); max-width: 55ch; }
    .hero h1 { margin-top: 7px; font-size: clamp(28px, 4vw, 46px); line-height: 1.05; letter-spacing: -.045em; font-weight: 700; color: var(--color-text); }
    .cache-banner {
      display: flex; align-items: center; gap: 10px; padding: 10px 13px;
      border: 1px solid color-mix(in srgb, var(--color-accent) 45%, var(--color-hairline));
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      border-radius: var(--radius-sm); color: var(--color-text-muted); font-size: 12px;
      flex-shrink: 0;
    }
    .cache-banner b { color: var(--color-on-accent); background: var(--color-accent); padding: 2px 6px; border-radius: 5px; font-size: 10px; }
    .section { margin-top: 20px; }
    .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 14px; }
    .section-head h2 { font-size: 20px; line-height: 1.2; letter-spacing: -.02em; color: var(--color-text); }
    .section-head p { color: var(--color-text-subtle); font-size: 12px; margin: 0; }
    .sample { color: var(--color-text-subtle); font: 10px 'Fira Code', monospace; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    details { min-width: 0; }
    details > summary { list-style: none; cursor: pointer; }
    details > summary::-webkit-details-marker { display: none; }
    .chart-card { padding: 16px; min-width: 0; }
    /* Tax breakdown card spans the full row — its 2 doughnuts fill the width */
    .chart-card.tax-full { grid-column: 1 / -1; }
    .chart-title { display: flex; justify-content: space-between; align-items: start; margin-bottom: 14px; gap: 10px; }
    .chart-title h3 { font-size: 15px; line-height: 1.25; color: var(--color-text); }
    .chart-title span { color: var(--color-text-subtle); font-size: 11px; }
    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 680px) {
      .app-shell { padding: 0 14px 34px; }
      .hero { display: block; padding-top: 25px; }
      .cache-banner { margin-top: 18px; }
      .kpi-grid, .chart-grid { grid-template-columns: 1fr; }
    }
    /* Onboarding banner compact on mobile (prototype: avoid eating viewport) */
    @media (max-width: 680px) {
      .onboarding-banner { flex-wrap: nowrap; gap: 8px; padding: 7px 10px; font-size: 11px; }
      .onboarding-banner b { flex-shrink: 0; }
      .onboarding-banner span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .onboarding-banner .primary-btn { min-height: 32px; padding: 0 10px; font-size: 11px; flex-shrink: 0; }
    }
  `],
  template: `
    <div class="app-shell">
      <!-- Mini onboarding banner (first visit only) -->
      @if (showOnboarding()) {
        <div class="cache-banner onboarding-banner" style="margin-top:18px">
          <b>{{ 'dashboard.onboarding.gotIt' | translate }}</b>
          <span>{{ 'dashboard.onboarding.message' | translate }}</span>
          <button
            (click)="dismissOnboarding()"
            class="primary-btn"
            [attr.aria-label]="'dashboard.onboarding.dismissAria' | translate"
          >
            {{ 'dashboard.onboarding.gotIt' | translate }}
          </button>
        </div>
      }

      <!-- Hero -->
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">{{ 'dashboard.hero.eyebrow' | translate }} · {{ countryName }}</div>
          <h1>{{ 'dashboard.hero.title' | translate }}</h1>
          <p>{{ 'dashboard.hero.subtitle' | translate }}</p>
        </div>
        <div class="cache-banner">
          <b>CACHED</b>
          <span>{{ 'dashboard.hero.cacheNote' | translate }}</span>
        </div>
      </section>

      <!-- Market / Country selector -->
      <section class="section">
        <div class="section-head">
          <h2>{{ 'dashboard.market.title' | translate }}</h2>
          <p>{{ 'dashboard.market.subtitle' | translate }} · {{ currencyService.currency() }}</p>
        </div>
        <app-country-selector variant="buttons" />
      </section>

      <!-- Price KPIs -->
      <section class="section">
        <div class="section-head">
          <h2>{{ 'dashboard.current.title' | translate }}</h2>
          <span class="sample">{{ 'dashboard.current.dataNote' | translate }}</span>
        </div>
        <app-price-current />
      </section>

      <!-- Tank calculator (prototype: single column, no install card) -->
      <section class="section">
        <app-tank-calculator />
      </section>

      <!-- Charts -->
      <section class="section">
        <div class="section-head">
          <h2>{{ 'dashboard.charts.title' | translate }}</h2>
          <p>{{ 'dashboard.charts.subtitle' | translate }}</p>
        </div>
        <div class="chart-grid">
          <details class="card chart-card" open>
            <summary class="chart-title">
              <span>
                <h3>{{ 'dashboard.price.chartTitle' | translate }}</h3>
                <span>{{ 'dashboard.charts.fuelLabel' | translate }}</span>
              </span>
              <span>12 {{ 'dashboard.charts.months' | translate }}</span>
            </summary>
            @defer (on viewport) {
              <app-price-chart />
            } @placeholder {
              <app-skeleton-loader variant="card" label="Loading price chart..." />
            }
          </details>

          <details class="card chart-card" open id="neighbor-compare">
            <summary class="chart-title">
              <span>
                <h3>{{ 'dashboard.compare.title' | translate }}</h3>
                <span>{{ 'dashboard.charts.compareSubtitle' | translate }}</span>
              </span>
              <span>5 {{ 'dashboard.charts.markets' | translate }}</span>
            </summary>
            @defer (on viewport) {
              <app-neighbor-compare />
            } @placeholder {
              <app-skeleton-loader variant="card" label="Loading comparison chart..." />
            }
          </details>

          <details class="card chart-card tax-full" open>
            <summary class="chart-title">
              <span>
                <h3>{{ 'dashboard.tax.title' | translate }}</h3>
                <span>{{ 'dashboard.charts.taxSubtitle' | translate }}</span>
              </span>
              <span>sample</span>
            </summary>
            @defer (on viewport) {
              <app-tax-breakdown />
            } @placeholder {
              <app-skeleton-loader variant="card" label="Loading tax breakdown..." />
            }
          </details>

        </div>
      </section>

      <!-- Back to top button (mobile only, appears after 300px scroll) -->
      @if (showBackToTop()) {
        <button
          (click)="scrollToTop()"
          class="md:hidden fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          [attr.aria-label]="'dashboard.onboarding.backToTop' | translate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      }
    </div>
  `,
})
export class DashboardComponent {
  protected readonly showOnboarding = signal(!localStorage.getItem('np-onboarded'));
  protected readonly showBackToTop = signal(false);

  protected readonly countryState = inject(CountryStateService);
  protected readonly currencyService = inject(CurrencyService);
  private readonly translate = inject(TranslateService);

  protected get countryName(): string {
    const c = this.countryState.selectedCountry();
    return this.translate.instant(`country.${c}`);
  }

  protected dismissOnboarding(): void {
    this.showOnboarding.set(false);
    localStorage.setItem('np-onboarded', 'true');
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.showBackToTop.set(window.scrollY > 300);
  }
}
