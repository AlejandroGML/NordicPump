import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { CACHE_TIMESTAMP_KEY } from '../shared/constants/cache-keys';

/**
 * DateFreshnessBanner — offline/data-freshness indicator.
 *
 * Spec: pwa-setup > Service Worker — stale-while-revalidate
 *   - Offline with cache → stale data served + freshness banner
 *   - Cache expired >24h → stale data still served with prominent date banner
 *
 * Behavior:
 *   - Shows when navigator.onLine is false: "Showing cached data from {date}"
 *   - Shows when cached data is >24h stale: date banner with last-known update
 *   - Hidden when online and data is fresh
 *   - Position: fixed bottom banner, non-intrusive, above install prompt
 *
 * Simplified implementation for foundation phase:
 *   - Uses navigator.onLine + online/offline events for offline detection
 *   - Cache date: reads from sessionStorage key CACHE_TIMESTAMP_KEY (set by API layer)
 *   - Stale threshold: 24 hours (86400000 ms)
 */
@Component({
  selector: 'app-freshness-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (showBanner()) {
      <aside
        data-testid="freshness-banner"
        class="fixed bottom-16 inset-x-0 z-40 bg-accent text-on-accent px-4 py-2 text-sm text-center font-medium shadow-md"
        [class.bg-accent]="!isExpired()"
        [class.bg-chart-high]="isExpired()"
        [class.text-on-accent]="!isExpired()"
        [class.text-white]="isExpired()"
        role="status"
        aria-live="polite"
      >
        @if (isOffline()) {
          @if (cacheDate()) {
            {{ translate.instant('pwa.offline.cachedData', { date: (cacheDate() | date:'mediumDate') ?? '' }) }}
          } @else {
            {{ translate.instant('pwa.offline.cachedGeneric') }}
          }
        } @else if (isExpired()) {
          {{ translate.instant('pwa.offline.staleData', { hours: hoursStale(), date: (cacheDate() | date:'mediumDate') ?? '' }) }}
        }
      </aside>
    }
  `,
})
export class FreshnessBannerComponent implements OnInit, OnDestroy {
  protected readonly translate = inject(TranslateService);

  /** Whether the banner should be visible */
  readonly showBanner = signal(false);

  /** Whether the browser is offline */
  readonly isOffline = signal(false);

  /** Whether cached data is >24h stale */
  readonly isExpired = signal(false);

  /** ISO timestamp of last cache update */
  readonly cacheDate = signal<string | null>(null);

  /** Number of hours since last cache update */
  readonly hoursStale = signal(0);

  private static readonly STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

  private readonly onlineHandler = (): void => this.checkState();
  private readonly offlineHandler = (): void => this.checkState();

  ngOnInit(): void {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.checkState();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  /**
   * Evaluate offline status + cache freshness and update signals.
   */
  private checkState(): void {
    const offline = !navigator.onLine;
    this.isOffline.set(offline);

    const cachedTimestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
    this.cacheDate.set(cachedTimestamp);

    if (cachedTimestamp) {
      const cacheTime = new Date(cachedTimestamp).getTime();
      const age = Date.now() - cacheTime;
      this.hoursStale.set(Math.floor(age / (60 * 60 * 1000)));
      this.isExpired.set(age > FreshnessBannerComponent.STALE_THRESHOLD_MS);
    }

    // Show banner if offline OR cache is expired
    this.showBanner.set(offline || (!!cachedTimestamp && this.isExpired()));
  }
}
