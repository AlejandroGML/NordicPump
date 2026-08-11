import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * OfflineFallback — displayed when navigating to an uncached route while offline.
 *
 * Spec: pwa-setup > Service Worker — stale-while-revalidate
 *   - Offline no cache → fallback page "You need an internet connection for the first visit"
 *
 * This component is rendered as a standalone page at /:lang/offline or shown
 * by the service worker when a navigation to an uncached URL fails while offline.
 *
 * Design tokens:
 *   - Background: surface-muted (#F1F5F9)
 *   - Text: text-muted (#475569)
 *   - Icon: amber accent (#F59E0B)
 */
@Component({
  selector: 'app-offline-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div class="text-center max-w-md">
        <!-- Offline icon — cloud with slash -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mx-auto mb-4 text-accent"
          aria-hidden="true"
        >
          <path d="M17.5 19a3.5 3.5 0 0 0 0-7h-.3A5.5 5.5 0 0 0 6.8 12" />
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M14 17.5a3.5 3.5 0 0 0-2-6.3" />
        </svg>

        <h1 class="text-h2 text-text mb-2">{{ title }}</h1>
        <p class="text-body-lg text-text-muted leading-relaxed">
          {{ description }}
        </p>

        <button
          class="mt-6 inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg
                 font-semibold hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-secondary transition-colors"
          (click)="retry()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          {{ retryLabel }}
        </button>
      </div>
    </main>
  `,
})
export class OfflineFallbackComponent {
  protected readonly title: string;
  protected readonly description: string;
  protected readonly retryLabel: string;

  constructor() {
    const translate = inject(TranslateService);
    this.title = translate.instant('pwa.offline.title');
    this.description = translate.instant('pwa.offline.description');
    this.retryLabel = translate.instant('pwa.offline.retry');
  }

  retry(): void {
    window.location.reload();
  }
}
