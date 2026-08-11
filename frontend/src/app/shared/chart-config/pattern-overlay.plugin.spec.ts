import { describe, it, expect, beforeEach } from 'vitest';
import { Chart, registerables, type Plugin } from 'chart.js';
import { patternOverlayPlugin } from './pattern-overlay.plugin';
import { ChartConfigService } from './chart-config.service';

Chart.register(...registerables);

/**
 * Spec: dashboard-charts > Pattern Overlay Plugin
 * - Plugin id is 'patternOverlay'
 * - Registered globally via Chart.register
 * - beforeDraw applies patterns to bar datasets
 * - Plugin structure follows Chart.js plugin interface
 */
describe('PatternOverlayPlugin', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
  });

  describe('plugin structure', () => {
    it('should have id patternOverlay', () => {
      expect(patternOverlayPlugin.id).toBe('patternOverlay');
    });

    it('should have a beforeDraw hook', () => {
      expect(typeof patternOverlayPlugin.beforeDraw).toBe('function');
    });
  });

  describe('beforeDraw behavior', () => {
    it('should not throw when called with a bar chart', () => {
      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['SE', 'DK'],
          datasets: [
            { label: 'Euro 95', data: [17.65, 21.50], backgroundColor: '#16A34A' },
          ],
        },
      });

      expect(() => {
        patternOverlayPlugin.beforeDraw?.(chart, { cancelable: true }, {});
      }).not.toThrow();

      chart.destroy();
    });

    it('should not throw when called with a line chart', () => {
      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Jun', 'Jul'],
          datasets: [
            { label: 'Euro 95', data: [17.65, 18.20], borderColor: '#16A34A' },
          ],
        },
      });

      expect(() => {
        patternOverlayPlugin.beforeDraw?.(chart, { cancelable: true }, {});
      }).not.toThrow();

      chart.destroy();
    });

    it('should handle chart with no datasets gracefully', () => {
      const chart = new Chart(canvas, {
        type: 'bar',
        data: { labels: [], datasets: [] },
      });

      expect(() => {
        patternOverlayPlugin.beforeDraw?.(chart, { cancelable: true }, {});
      }).not.toThrow();

      chart.destroy();
    });
  });

  describe('global registration', () => {
    it('should register plugin globally via Chart.register', () => {
      // Re-register to verify idempotency
      Chart.register(patternOverlayPlugin);
      const registered = Chart.registry.plugins.get('patternOverlay');
      expect(registered).toBeDefined();
    });
  });
});
