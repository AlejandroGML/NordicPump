import { Injectable } from '@angular/core';
import { Chart } from 'chart.js';

/**
 * Color band as defined in DESIGN.md chart semantics.
 */
export type ColorBand = 'low' | 'mid' | 'high';

/**
 * All chart colors — color bands plus supplementary chart-specific colors.
 */
export type ChartColor = ColorBand | 'vat' | 'other' | 'unavailable' | 'primary' | 'secondary' | 'sky' | 'surface';

/**
 * Animation configuration for Chart.js.
 */
export interface ChartAnimationConfig {
  duration: number;
  easing: string;
}

/**
 * Shared Chart.js configuration for all dashboard charts.
 *
 * Design: dashboard-charts > ChartConfigService
 * - Sets Chart.defaults once (font, color, responsiveness)
 * - Exposes DESIGN.md chart color tokens
 * - Respects prefers-reduced-motion for animation
 * - Generates and caches offscreen Canvas fill patterns for colorblind a11y
 */
@Injectable({ providedIn: 'root' })
export class ChartConfigService {
  /**
   * DESIGN.md chart color tokens, read LIVE from the theme CSS variables.
   *
   * Unlike static hex values, this makes every chart adapt to the active
   * theme (light/dark) automatically — the prototype's chart colors
   * (--chart-low: #22C55E in dark, etc.) are honored without re-rendering.
   */
  private readonly varMap: Record<ChartColor, string> = {
    low: '--color-chart-low',
    mid: '--color-chart-mid',
    high: '--color-chart-high',
    vat: '--color-chart-vat',
    other: '--color-chart-other',
    unavailable: '--color-chart-unavailable',
    primary: '--color-primary',
    secondary: '--color-secondary',
    sky: '--color-sky',
    surface: '--color-surface',
  };

  /** Resolve a chart color from the current theme's CSS variable. */
  get colors(): Record<ChartColor, string> {
    const styles = getComputedStyle(document.documentElement);
    const resolved = {} as Record<ChartColor, string>;
    for (const [key, cssVar] of Object.entries(this.varMap) as [ChartColor, string][]) {
      resolved[key] = styles.getPropertyValue(cssVar).trim() || this.fallbackColors[key];
    }
    return resolved;
  }

  /** Hardcoded fallbacks (used when CSS vars are unavailable, e.g. jsdom tests). */
  private readonly fallbackColors: Record<ChartColor, string> = {
    low: '#16A34A',
    mid: '#F59E0B',
    high: '#DC2626',
    vat: '#3B82F6',
    other: '#64748B',
    unavailable: '#94A3B8',
    primary: '#1E40AF',
    secondary: '#3B82F6',
    sky: '#0EA5E9',
    surface: '#FFFFFF',
  };

  /** Price-band thresholds (EUR) for color coding. */
  readonly thresholds = {
    lowMax: 1,
    midMax: 3,
  };

  /**
   * Returns the color band for a given EUR price.
   * Returns 'unavailable' when price ≤ 0 (no data).
   */
  bandForPrice(priceEur: number, available = true): ChartColor {
    if (!available || priceEur <= 0) return 'unavailable';
    if (priceEur < this.thresholds.lowMax) return 'low';
    if (priceEur <= this.thresholds.midMax) return 'mid';
    return 'high';
  }

  /** Offscreen pattern cache: band → CanvasPattern. */
  private readonly patternCache = new Map<ColorBand, CanvasPattern>();

  /** Set Chart.js global defaults matching DESIGN.md typography tokens. */
  applyDefaults(): void {
    Chart.defaults.font.family = 'Fira Code';
    Chart.defaults.color = '#1E3A8A';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }

  /**
   * Returns animation config respecting user motion preferences.
   * 600ms easeOutQuart by default; duration 0 when prefers-reduced-motion.
   */
  getAnimationConfig(): ChartAnimationConfig {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      return { duration: 0, easing: 'linear' };
    }
    return { duration: 600, easing: 'easeOutQuart' };
  }

  /**
   * Returns a cached offscreen CanvasPattern for the given price band.
   * Patterns provide colorblind-accessible differentiation:
   * - low: 45° diagonal stripes (6px gap)
   * - mid: crossed grid lines (8px gap)
   * - high: dot pattern (4px radius, 8px spacing)
   */
  getPattern(band: ColorBand, ctx: CanvasRenderingContext2D): CanvasPattern {
    const cached = this.patternCache.get(band);
    if (cached) return cached;

    const size = 16;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d')!;

    switch (band) {
      case 'low': {
        // 45° diagonal stripes
        octx.strokeStyle = 'rgba(255,255,255,0.3)';
        octx.lineWidth = 2;
        octx.beginPath();
        octx.moveTo(0, 0);
        octx.lineTo(size, size);
        octx.stroke();
        break;
      }
      case 'mid': {
        // Crossed grid lines
        octx.strokeStyle = 'rgba(255,255,255,0.3)';
        octx.lineWidth = 2;
        octx.beginPath();
        octx.moveTo(0, 0);
        octx.lineTo(size, size);
        octx.moveTo(size, 0);
        octx.lineTo(0, size);
        octx.stroke();
        break;
      }
      case 'high': {
        // Dot pattern
        octx.fillStyle = 'rgba(255,255,255,0.35)';
        octx.beginPath();
        octx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
        octx.fill();
        break;
      }
    }

    const pattern = ctx.createPattern(offscreen, 'repeat')!;
    this.patternCache.set(band, pattern);
    return pattern;
  }
}
