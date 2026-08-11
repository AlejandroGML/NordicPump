# Design — Dashboard Chart Components

## Architecture Decision: Chart.js Core Only

**Decision**: Depend on `chart.js` npm package only. No `chartjs-plugin-datalabels`.

**Rationale**:
- Each chart mandates an accessible `<table>` below the canvas, making datalabels redundant
- Fewer dependencies = smaller bundle, fewer CVEs
- Pattern overlay plugin is custom (Canvas API) — no external plugin needed
- Chart.js v4 built-in tooltips suffice for hover interactions

## Component Tree

```
DashboardComponent
├── CountrySelector (existing)
├── PriceCurrent (existing)
├── PriceChartComponent          ◀── NEW
│   ├── <canvas> (Chart.js)
│   └── <table> (a11y data table)
├── NeighborCompareComponent     ◀── NEW
│   ├── <canvas> (Chart.js)
│   └── <table>
├── TaxBreakdownComponent        ◀── NEW
│   ├── <canvas> (Chart.js)
│   └── <table>
└── SeasonalityChartComponent    ◀── NEW
    ├── <canvas> (Chart.js)
    └── <table>
```

All components are **standalone** (`standalone: true`), no shared Angular module. Each injects `HttpClient`, `CountryStateService`, and `TranslateService` directly.

## Shared Chart Configuration

### ChartConfigService (providedIn: 'root')

```typescript
@Injectable({ providedIn: 'root' })
class ChartConfigService {
  // Global Chart.js defaults set once via Chart.defaults
  applyDefaults(): void { ... }
  
  // DESIGN.md chart colors map
  readonly colors = { low: '#16A34A', mid: '#F59E0B', high: '#DC2626' };
  
  // Font config: Fira Code for labels, Fira Sans for titles
  readonly font = { family: 'Fira Code', size: 12 };
  
  // Animation: 600ms ease-out, skip if prefers-reduced-motion
  getAnimationConfig(): ChartAnimationConfig { ... }
  
  // Pattern registry: caches offscreen canvases by color band
  getPattern(band: 'low' | 'mid' | 'high', ctx: CanvasRenderingContext2D): CanvasPattern { ... }
}
```

Called once in `APP_INITIALIZER` or component `ngOnInit`. Every chart component calls `getAnimationConfig()` and `getPattern()`.

### Pattern Overlay Plugin

Custom Chart.js plugin (`id: 'patternOverlay'`):
- **`beforeDraw`**: For bar charts — fill each bar with the cached CanvasPattern after default draw
- **`afterDraw`**: For line charts — apply dashed `borderDash` on datasets (no fill pattern, just line differentiation)
- Patterns: `stripe` (low, 45° lines 6px gap), `grid` (mid, crossed lines 8px), `dot` (high, 4px radius dots)
- Offscreen canvas: 16×16px, drawn once and cached via Map

```typescript
const patternPlugin = {
  id: 'patternOverlay',
  beforeDraw(chart: Chart) {
    // For bar charts: fill each dataset with pattern
    // Skip for line charts (use borderDash instead)
  }
};
Chart.register(patternPlugin);
```

## Data Flow

```
GET /api/v1/prices/{country}
       │
       ▼
  PriceResponse { country, prices: PriceRecord[] }
       │
       ├──▶ price-chart: maps to Chart.js datasets (line/bar)
       ├──▶ tax-breakdown: maps price_breakdown → stacked datasets
       └──▶ seasonality-chart: groups by month → line datasets

GET /api/v1/prices/se + /dk + /fi + /no  (forkJoin)
       │
       ▼
  PriceResponse[] (4 entries)
       │
       └──▶ neighbor-compare: sorts by price_sek → horizontal bar datasets
```

All HTTP calls follow existing `price-current` pattern: direct `HttpClient.get()`, no intermediate service layer.

## Sequence: Price Chart Render

```
User selects country (CountrySelector)
  │
  ▼
CountryStateService.selectedCountry.set('DK')
  │
  ▼
PriceChartComponent.effect() fires
  │
  ▼
loadPrices('DK')
  ├── loading.set(true)
  ├── HTTP GET /api/v1/prices/dk ──────────▶ Backend
  │                                          │
  │  ◀────── 200 { country: "DK", prices: […] }
  │
  ├── prices.set(data)
  ├── buildChartConfig(data)  ──▶ ChartConfigService.getAnimationConfig()
  │                          ──▶ ChartConfigService.getPattern(band)
  │
  ├── new Chart(canvas, config)
  │     ├── Chart.js draws canvas with animations
  │     ├── patternOverlay plugin applies fill patterns
  │     └── aria-label + aria-describedby set on canvas
  │
  ├── buildDataTable(data) → renders <table>
  └── loading.set(false)
```

## Test Strategy (Vitest + JSDOM)

### Canvas Mocking

```typescript
// test-setup.ts
import 'vitest-canvas-mock';
// OR manual mock:
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  createPattern: vi.fn(() => ({})),
  fillRect: vi.fn(),
  // … minimal Chart.js-compatible mock
}));
```

### Test Layers per Component

| Layer | What | Tool |
|-------|------|------|
| Unit — ChartConfigService | Animation config, color map, pattern creation | Vitest |
| Unit — Pattern Plugin | Plugin hooks, pattern types | Vitest + canvas mock |
| Integration — Component + Chart.js | Data→config→render pipeline | TestBed + canvas mock |
| A11y — Data Table | Keyboard nav, aria attributes | TestBed + TestingLibrary |

### Coverage Target: 80% per component

## Responsive Breakpoints

| Breakpoint | Chart Behavior |
|------------|---------------|
| < 768px | Full-width charts, abbreviated labels, horizontal scroll tables |
| 768–1023px | 2-column grid (2 charts per row) |
| ≥ 1024px | 2-column grid, max-w-4xl containers |

## Dependency Chain (PR slicing)

```
PR #1: chart.js dep + ChartConfigService + Pattern Plugin + test mocks
  ↓
PR #2: price-chart component
  ↓
PR #3: neighbor-compare component
  ↓
PR #4: tax-breakdown component
  ↓
PR #5: seasonality-chart component
  ↓
PR #6: Dashboard grid wiring (all 4 charts integrated)
```

Budget forecast: 4 components × ~100 lines each + shared config (~80) + tests (~150) + dashboard wiring (~60) ≈ **700 lines total**. Force-chained: 5–6 PRs at ~120–150 lines each.
