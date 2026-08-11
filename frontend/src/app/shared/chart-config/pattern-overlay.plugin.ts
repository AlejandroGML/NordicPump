import type { Chart, Plugin } from 'chart.js';

/**
 * Compute a quick stable hash of chart dataset data to detect changes.
 * Used to skip pattern redraws when the data hasn't changed.
 */
function simpleDataHash(chart: Chart): string {
  let hash = '';
  for (const meta of chart.getSortedVisibleDatasetMetas()) {
    for (const point of meta.data) {
      hash += String((point as { x: number; y: number }).x) + ':' + String((point as { x: number; y: number }).y) + '|';
    }
  }
  return hash;
}

/**
 * Chart.js plugin that applies inline Canvas fill patterns to bar chart
 * datasets for colorblind-accessible differentiation.
 *
 * Design: dashboard-charts > Pattern Overlay Plugin
 * - For bar charts: draws stroke-based pattern overlays per dataset index
 *   (diagonal stripes, cross-hatch, dots) for colorblind a11y
 * - For line charts: differentiation handled via borderDash in dataset config
 *   (not in this plugin)
 *
 * Performance: tracks a data hash to skip redraw when chart data hasn't changed,
 * avoiding unnecessary pattern re-painting on every animation frame.
 */

/** WeakMap keyed by chart instance to store last-drawn hash. */
const chartHashes = new WeakMap<Chart, string | null>();

export const patternOverlayPlugin: Plugin = {
  id: 'patternOverlay',

  beforeDraw(chart) {
    const newHash = simpleDataHash(chart);
    if (chartHashes.get(chart) === newHash) return;
    chartHashes.set(chart, newHash);

    const ctx = chart.ctx;
    const metasets = chart.getSortedVisibleDatasetMetas();

    // Only apply pattern fills to bar-type datasets
    if ((chart.config as { type?: string }).type !== 'bar') return;

    const isHorizontal = (chart.options as { indexAxis?: string }).indexAxis === 'y';

    for (const meta of metasets) {
      if (!meta.data?.length) continue;

      for (const element of meta.data) {
        // Each bar element has x, y, width, height, base
        const { x, y, width, height } = element as unknown as {
          x: number;
          y: number;
          base: number;
          width: number;
          height: number;
        };

        if (width === 0 || height === 0) continue;

        ctx.save();
        // Clip to bar area so pattern only fills the bar
        ctx.beginPath();
        if (isHorizontal) {
          // Horizontal bars: x is the left edge, y is the center
          ctx.rect(x, y - height / 2, width, height);
        } else {
          // Vertical bars: x is the center, y is the top edge
          ctx.rect(x - width / 2, y, width, height);
        }
        ctx.clip();

        // Apply stroke-based pattern overlay for colorblind differentiation
        const patternIdx = meta.index % PATTERN_DRAWERS.length;
        PATTERN_DRAWERS[patternIdx](ctx, width, height);

        ctx.restore();
      }
    }
  },
};

/**
 * Pattern drawer functions keyed by dataset index.
 * Each function draws a different stroke-based pattern at 0.15 opacity
 * for colorblind-accessible differentiation.
 */
const PATTERN_DRAWERS: Array<(ctx: CanvasRenderingContext2D, w: number, h: number) => void> = [
  // Diagonal lines (top-left → bottom-right)
  (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    const step = 8;
    for (let offset = -h; offset < w + h; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + h, h);
      ctx.stroke();
    }
  },
  // Diagonal lines (bottom-left → top-right)
  (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    const step = 8;
    for (let offset = -h; offset < w + h; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, h);
      ctx.lineTo(offset + h, 0);
      ctx.stroke();
    }
  },
  // Vertical lines
  (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    const step = 6;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  },
  // Dotted grid
  (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const spacing = 8;
    for (let px = spacing / 2; px < w; px += spacing) {
      for (let py = spacing / 2; py < h; py += spacing) {
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
];
