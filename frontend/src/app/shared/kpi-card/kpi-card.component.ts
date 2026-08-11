import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Reusable KPI card — redesign style.
 *
 * Design: nordicpump-redesign.html → .kpi
 * - Label row with trend indicator floated right
 * - Large Fira Code price
 * - Meta line (e.g. "Media nacional · hoy")
 * - Trend semantics: price DROP = 'down' → green ↘ (good for consumer),
 *   price RISE = 'up' → red ↗ (bad). Matches prototype.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; height: 100%; }
    .kpi {
      background: var(--color-surface);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 17px;
      min-height: 142px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background var(--transition), border-color var(--transition);
    }
    .label { color: var(--color-text-muted); font-size: 12px; }
    .price { margin: 8px 0 4px; font: 700 clamp(23px, 3vw, 32px)/1 'Fira Code', monospace; letter-spacing: -.05em; }
    .meta { color: var(--color-text-subtle); font-size: 11px; }
    /* Default (up = price rose) → red; .down (price dropped) → green.
       Prototype semantics: drop is good for the consumer (green). */
    .trend { float: right; color: var(--color-chart-high); font-weight: 700; font-variant-numeric: tabular-nums; }
    .trend.down { color: var(--color-chart-low); }
  `],
  template: `
    <div
      data-testid="kpi-card"
      class="kpi"
      [attr.tabindex]="clickable ? 0 : null"
      [attr.role]="clickable ? 'button' : null"
      (click)="clickable && onClick.emit()"
      (keydown.enter)="clickable && onEnterOrSpace()"
      (keydown.space)="clickable && onEnterOrSpace()"
    >
      <div>
        <span data-testid="kpi-title" class="label">{{ title }}
          @if (trend) {
            <span
              data-testid="kpi-trend"
              class="trend"
              [class.down]="trend === 'down'"
            >
              @if (trend === 'up') { ↗ }
              @else if (trend === 'down') { ↘ }
              @else { → }
              @if (trendDelta) { {{ trendDelta }} }
            </span>
          }
        </span>
        <p
          data-testid="kpi-value"
          class="price"
          [attr.aria-label]="title + ': ' + value + (trend ? ', ' + trendLabel(trend) : '')"
        >{{ value }}</p>
      </div>
      @if (subtitle) {
        <p data-testid="kpi-subtitle" class="meta">{{ subtitle }}</p>
      }
    </div>
  `,
})
export class KpiCardComponent {
  private readonly translate = inject(TranslateService);

  @Input() title = '';
  @Input() value = '';
  @Input() subtitle?: string;
  @Input() trend?: 'up' | 'down' | 'neutral';
  @Input() trendDelta?: string;
  @Input() variant: 'solid' | 'glass' = 'solid';
  @Input() clickable = false;
  @Input() colorBand?: 'low' | 'mid' | 'high';
  @Output() onClick = new EventEmitter<void>();

  protected trendLabel(t: 'up' | 'down' | 'neutral'): string {
    return this.translate.instant(`dashboard.trend.${t}`);
  }

  protected onEnterOrSpace(): void {
    this.onClick.emit();
  }
}
