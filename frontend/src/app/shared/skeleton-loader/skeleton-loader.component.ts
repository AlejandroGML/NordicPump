import { Component, Input, signal, ChangeDetectionStrategy } from '@angular/core';

/**
 * Accessible loading skeleton with pulse animation.
 *
 * Spec: dashboard-core > skeleton-loader
 * - Variants: text (default), card, circle
 * - Tailwind animate-pulse with surface-muted background
 * - Respects prefers-reduced-motion (disables animation)
 * - aria-busy="true", role="status" for screen readers
 * - Visually-hidden loading label
 */
@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="skeleton"
      role="status"
      [attr.aria-busy]="true"
      [class.animate-pulse]="!reducedMotion()"
      class="bg-surface-muted"
      [style.width]="
        width
          || (variant === 'card' ? '240px'
          : variant === 'circle' ? '48px'
          : '100%')
      "
      [style.height]="
        height
          || (variant === 'card' ? '160px'
          : variant === 'circle' ? '48px'
          : '20px')
      "
      [style.border-radius]="
        rounded === 'full' ? '9999px'
        : rounded || (variant === 'circle' ? '9999px'
        : variant === 'card' ? '12px'
        : '8px')
      "
    >
      @if (variant === 'card') {
        <div class="flex flex-col gap-2 p-4 h-full justify-between">
          <div
            data-testid="skeleton-line"
            class="bg-surface-muted rounded-sm"
            style="height: 12px; width: 60%"
          ></div>
          <div
            data-testid="skeleton-line"
            class="bg-surface-muted rounded-sm"
            style="height: 24px; width: 40%"
          ></div>
          <div
            data-testid="skeleton-line"
            class="bg-surface-muted rounded-sm"
            style="height: 12px; width: 30%"
          ></div>
        </div>
      }
      <span class="sr-only">{{ label || 'Loading...' }}</span>
    </div>
  `,
})
export class SkeletonLoaderComponent {
  /** Skeleton variant: text line, card placeholder, or circle avatar. */
  @Input() variant: 'text' | 'card' | 'circle' = 'text';

  /** Custom width (CSS value), overrides variant default. */
  @Input() width = '';

  /** Custom height (CSS value), overrides variant default. */
  @Input() height = '';

  /** Custom border-radius (CSS value), overrides variant default. */
  @Input() rounded = '';

  /** Label for screen readers (default: "Loading..."). */
  @Input() label = '';

  /** Whether prefers-reduced-motion is active. */
  protected readonly reducedMotion = signal(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}
