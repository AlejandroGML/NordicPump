/**
 * FreshnessBannerComponent Tests — CRITICAL #3 + #5 fix
 *
 * Spec: pwa-setup > SW stale-while-revalidate
 *   - Offline with cache → stale data served + freshness banner
 *   - Cache expired >24h → prominent date banner
 *
 * Tests cover:
 *   - Banner hidden when online and data fresh
 *   - Banner shown when offline
 *   - Banner shown when data >24h stale
 *   - Cache date displayed when available
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { FreshnessBannerComponent } from './freshness-banner.component';

const translateMock = {
  instant: (key: string, params?: Record<string, unknown>) => {
    if (key === 'pwa.offline.cachedData') return `Showing cached data from ${params?.['date'] ?? ''}`;
    if (key === 'pwa.offline.cachedGeneric') return 'You\'re viewing cached data. Some information may be outdated.';
    if (key === 'pwa.offline.staleData') return `Data is ${params?.['hours'] ?? ''} hours old. Last updated ${params?.['date'] ?? ''}.`;
    return key;
  },
};

describe('FreshnessBannerComponent', () => {
  let fixture: ComponentFixture<FreshnessBannerComponent>;
  let component: FreshnessBannerComponent;

  beforeEach(async () => {
    // Reset navigator.onLine and sessionStorage before each test
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [FreshnessBannerComponent],
      providers: [{ provide: TranslateService, useValue: translateMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(FreshnessBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('initial state', () => {
    it('should not show banner when online and no cached data', () => {
      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeNull();
    });

    it('should have role="status" and aria-live="polite"', () => {
      // Simulate offline to render banner
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeTruthy();
      expect(banner.getAttribute('role')).toBe('status');
      expect(banner.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('offline detection', () => {
    it('should show banner when browser goes offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeTruthy();
    });

    it('should hide banner when browser comes back online (no stale data)', () => {
      // First go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
      fixture.detectChanges();

      // Then come online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      window.dispatchEvent(new Event('online'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeNull();
    });
  });

  describe('cache date display', () => {
    it('should show cache date when offline with cached timestamp', () => {
      const yesterday = new Date(Date.now() - 3600000).toISOString();
      sessionStorage.setItem('np-cache-timestamp', yesterday);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('Showing cached data');
    });

    it('should show generic message when offline without cache date', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain("You're viewing cached data");
    });
  });

  describe('stale data >24h', () => {
    it('should show expired banner when data is >24h old while online', () => {
      // Set cache timestamp to 25 hours ago
      const staleDate = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      sessionStorage.setItem('np-cache-timestamp', staleDate);

      // Force a fresh state check by dispatching online event
      window.dispatchEvent(new Event('online'));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector(
        '[data-testid="freshness-banner"]',
      );
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('hours old');
    });

    it('should count stale hours correctly', () => {
      const staleDate = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      sessionStorage.setItem('np-cache-timestamp', staleDate);

      window.dispatchEvent(new Event('online'));
      fixture.detectChanges();

      expect(component.isExpired()).toBe(true);
      expect(component.hoursStale()).toBeGreaterThanOrEqual(24);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on destroy', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      component.ngOnDestroy();
      expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});
