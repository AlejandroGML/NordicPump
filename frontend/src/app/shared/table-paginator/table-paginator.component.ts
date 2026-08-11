import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Reusable table paginator with page navigation.
 *
 * Displays "Page X of Y" with Previous/Next buttons and numbered page links.
 * All interactive elements meet WCAG 2.5.5 AA (min 44px touch targets).
 *
 * Usage:
 *   <app-table-paginator
 *     [currentPage]="page()"
 *     [totalPages]="totalPages()"
 *     (pageChange)="onPageChange($event)"
 *   />
 */
@Component({
  selector: 'app-table-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="flex items-center justify-center gap-2 mt-4"
      [attr.aria-label]="translate.instant('paginator.aria')"
    >
      <!-- Previous button -->
      <button
        [disabled]="currentPage() <= 1"
        (click)="goTo(currentPage() - 1)"
        class="px-3 py-2 min-w-[44px] min-h-[44px] rounded-md border border-hairline bg-surface text-body-sm text-text hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        [attr.aria-label]="translate.instant('paginator.prev')"
      >
        ←
      </button>

      <!-- Page numbers -->
      @for (page of visiblePages(); track page) {
        @if (page === -1) {
          <span class="px-2 text-text-muted" aria-hidden="true">…</span>
        } @else {
          <button
            [class.bg-primary]="page === currentPage()"
            [class.text-on-primary]="page === currentPage()"
            [class.bg-surface]="page !== currentPage()"
            [class.text-text]="page !== currentPage()"
            (click)="goTo(page)"
            class="px-3 py-2 min-w-[44px] min-h-[44px] rounded-md border border-hairline text-body-sm hover:bg-surface-muted transition-colors"
            [attr.aria-label]="translate.instant('paginator.page') + ' ' + page"
            [attr.aria-current]="page === currentPage() ? 'page' : undefined"
          >
            {{ page }}
          </button>
        }
      }

      <!-- Next button -->
      <button
        [disabled]="currentPage() >= totalPages()"
        (click)="goTo(currentPage() + 1)"
        class="px-3 py-2 min-w-[44px] min-h-[44px] rounded-md border border-hairline bg-surface text-body-sm text-text hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        [attr.aria-label]="translate.instant('paginator.next')"
      >
        →
      </button>
    </nav>
  `,
})
export class TablePaginatorComponent {
  protected readonly translate = inject(TranslateService);

  /** Current page number (1-based). */
  readonly currentPage = input.required<number>();

  /** Total number of pages. */
  readonly totalPages = input.required<number>();

  /** Emits the new page number (1-based) when user navigates. */
  readonly pageChange = output<number>();

  /** Compute which page numbers to show with ellipsis for large ranges. */
  protected readonly visiblePages = computed(() => {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: number[] = [];

    if (total <= 7) {
      // Show all pages
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    // Always show first page
    pages.push(1);

    // Ellipsis or nearby pages
    if (current > 3) pages.push(-1);

    // Pages around current
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    // Ellipsis or nearby pages
    if (current < total - 2) pages.push(-1);

    // Always show last page
    pages.push(total);

    return pages;
  });

  protected goTo(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageChange.emit(page);
  }
}
