import { Chart, registerables } from 'chart.js';
import { patternOverlayPlugin } from './pattern-overlay.plugin';

/**
 * Centralised Chart.js registration.
 *
 * All chart-level side-effects (registering components and plugins) happen
 * exactly once when this module is imported in `main.ts`.
 *
 * Previously each chart component imported Chart.register at module-top,
 * duplicating the same side-effect 4×.
 */
Chart.register(...registerables, patternOverlayPlugin);
