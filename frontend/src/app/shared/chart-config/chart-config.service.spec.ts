import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Chart, registerables } from 'chart.js';
import { ChartConfigService } from './chart-config.service';

// Register Chart.js defaults so Chart.defaults is available
Chart.register(...registerables);

/**
 * Spec: dashboard-charts > ChartConfigService
 * - Global Chart.js defaults (font, color)
 * - Design token color map
 * - Animation config with prefers-reduced-motion detection
 * - Pattern generation from offscreen canvas
 */
describe('ChartConfigService', () => {
  let service: ChartConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChartConfigService],
    });
    service = TestBed.inject(ChartConfigService);
  });

  describe('applyDefaults', () => {
    it('should set Chart.defaults.font.family to Fira Code on apply', () => {
      service.applyDefaults();
      expect(Chart.defaults.font.family).toBe('Fira Code');
    });

    it('should set Chart.defaults.color to text token #1E3A8A on apply', () => {
      service.applyDefaults();
      expect(Chart.defaults.color).toBe('#1E3A8A');
    });

    it('should set responsive and maintainAspectRatio defaults', () => {
      service.applyDefaults();
      expect(Chart.defaults.responsive).toBe(true);
      expect(Chart.defaults.maintainAspectRatio).toBe(false);
    });
  });

  describe('colors', () => {
    it('should expose chart-low as #16A34A', () => {
      expect(service.colors.low).toBe('#16A34A');
    });

    it('should expose chart-mid as #F59E0B', () => {
      expect(service.colors.mid).toBe('#F59E0B');
    });

    it('should expose chart-high as #DC2626', () => {
      expect(service.colors.high).toBe('#DC2626');
    });
  });

  describe('getAnimationConfig', () => {
    it('should return 600ms duration with easeOutQuart when no reduced-motion', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList));

      const config = service.getAnimationConfig();
      expect(config.duration).toBe(600);
      expect(config.easing).toBe('easeOutQuart');
    });

    it('should return duration 0 when prefers-reduced-motion: reduce', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList));

      const config = service.getAnimationConfig();
      expect(config.duration).toBe(0);
    });
  });

  describe('getPattern', () => {
    it('should return a CanvasPattern for low band pattern', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const pattern = service.getPattern('low', ctx);
      expect(pattern).toBeDefined();
    });

    it('should return the same pattern on second call (cached)', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const first = service.getPattern('mid', ctx);
      const second = service.getPattern('mid', ctx);
      expect(first).toBe(second);
    });

    it('should return different patterns for different bands', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const lowPattern = service.getPattern('low', ctx);
      const highPattern = service.getPattern('high', ctx);
      expect(lowPattern).not.toBe(highPattern);
    });
  });
});
