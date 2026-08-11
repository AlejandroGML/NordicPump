import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * Presentational error + retry block shared across dashboard components.
 *
 * Replaces the duplicated template block that appeared in 6 components.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 p-8 bg-surface border border-hairline rounded-lg text-center">
      <p class="text-text-muted text-body-sm">{{ message }}</p>
      <button
        (click)="retry.emit()"
        class="px-4 py-2 bg-primary text-on-primary rounded-md text-body-sm cursor-pointer min-w-[44px] min-h-[44px]"
      >
        {{ retryLabel }}
      </button>
    </div>
  `,
})
export class ErrorStateComponent {
  @Input() message = '';
  @Input() retryLabel = 'Retry';
  @Output() retry = new EventEmitter<void>();
}
