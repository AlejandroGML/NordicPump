import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Application footer — copyright + data source attributions.
 *
 * Design: nordicpump-redesign.html → footer
 * - Copyright: "© {year} NordicPump" — year is dynamic
 * - Data source attribution: fuel-prices.eu (CC BY 4.0) + SSB Statbank
 * - role="contentinfo" for a11y
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    footer {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 28px 22px 0;
      max-width: 1440px;
      margin: 0 auto;
      color: var(--color-text-subtle);
      font-size: 11px;
    }
    a { color: var(--color-text-subtle); }
    @media (max-width: 680px) {
      footer { display: block; padding: 28px 14px 0; }
      footer p + p { margin-top: 6px; }
    }
  `],
  template: `
    <footer role="contentinfo">
      <p>&copy; {{ currentYear }} NordicPump</p>
      <p>
        {{ dataSources }}
        <a href="https://www.fuel-prices.eu" target="_blank" rel="noopener noreferrer">fuel-prices.eu</a>
        · <a href="https://www.ssb.no/en/statbank" target="_blank" rel="noopener noreferrer">SSB Statbank</a>
      </p>
    </footer>
  `,
})
export class FooterComponent {
  private readonly translate = inject(TranslateService);

  protected get currentYear(): number {
    return new Date().getFullYear();
  }

  protected get dataSources(): string {
    return this.translate.instant('footer.dataSources');
  }
}
