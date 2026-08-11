# Proposal: Dashboard Chart Components

## Intent

NordicPump dashboard needs data visualization to turn raw API prices into actionable insight. Users must compare prices across countries, see price composition (taxes), and understand seasonal patterns — not just static KPI numbers.

## Scope

### In Scope
- **price-chart** — Line/bar chart with historical price trends via `/api/v1/prices/{country}`, Chart.js draw-in animation (600ms ease-out), pattern overlay for colorblind, data table below
- **neighbor-compare** — Horizontal bar comparing 4 Nordic countries (cheapest→most expensive), color bands per DESIGN.md
- **tax-breakdown** — Stacked bar: product cost, excise duty, VAT, other taxes; stagger animation (500ms per bar)
- **seasonality-chart** — Line chart of monthly price trends using historical data; highlights seasonal patterns
- **Shared chart config** — Chart.js defaults (colors, Fira Code labels, animations, pattern plugin)

### Out of Scope
- Real-time WebSocket price updates
- User-customizable chart ranges
- Tank-calculator (separate component)

## Capabilities

### New Capabilities
- `price-chart`: Historical price line/bar chart with a11y data table, draw-in animation, colorblind pattern overlay
- `neighbor-compare`: Sorted horizontal bar comparison across SE/DK/FI/NO with color-band coding
- `tax-breakdown`: Stacked bar decomposition of price into product cost + taxes with stagger animation
- `seasonality-chart`: Monthly price trend line chart with seasonal pattern highlighting

### Modified Capabilities
None — these are net new components. Existing `prices-api`, `country-selector`, `price-current`, `kpi-card` are consumed but unchanged.

## Approach

- **Chart.js core only** (no datalabels plugin) — data table below each chart serves as accessible data source; cleaner visual
- Shared `ChartConfigService` sets global defaults: Fira Code labels, DESIGN.md chart colors, 600ms animations, pattern overlay via Canvas API
- Each chart: standalone Angular component, `<canvas>` + `<table>` below
- Pattern overlay generated via `createPattern()` on a tiny offscreen canvas (stripes/grid per price band) — applied through Chart.js plugin
- `prefers-reduced-motion: reduce` → skip all animations via `window.matchMedia()`
- Consumes `CountryStateService` for reactive country selection
- `HttpClient` fetches `/api/v1/prices/{country}` directly (no intermediate service — follow existing `price-current` pattern)
- `ng test`/Vitest for all test coverage (strict TDD per config.yaml)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/package.json` | Modified | Add `chart.js` dep |
| `frontend/src/app/shared/price-chart/` | New | Price chart component |
| `frontend/src/app/shared/neighbor-compare/` | New | Country comparison component |
| `frontend/src/app/shared/tax-breakdown/` | New | Tax decomposition component |
| `frontend/src/app/shared/seasonality-chart/` | New | Seasonality component |
| `frontend/src/app/shared/chart-config/` | New | Shared Chart.js defaults + pattern plugin |
| `frontend/src/app/features/dashboard/` | Modified | Wire charts into dashboard grid |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Chart.js canvas rendering breaks in Vitest JSDOM | Med | Mock `HTMLCanvasElement.getContext()` with `canvas` npm; use `vitest-canvas-mock` |
| Tax data not in API response | Med | Derive breakdown from raw price when `price_breakdown` absent; flag missing source |
| Pattern overlay performance on mobile | Low | Cache pattern canvases; debounce resize |
| 4 charts exceed 400-line budget | High | Force-chained PRs; each chart = 1 PR slice (see chained-pr skill) |

## Rollback Plan

Remove chart component directories from `frontend/src/app/shared/`. Revert `package.json` chart.js dep. Dashboard grid falls back to card-only layout. No API or DB changes.

## Dependencies

- `chart.js` npm (MIT) — core library
- Existing `CountryStateService`, `HttpClient`, `SkeletonLoaderComponent`, `TranslateService`
- `/api/v1/prices/{country}` response format (already spec'd in `prices-api`)

## Success Criteria

- [ ] All 4 charts render with real API data and DESIGN.md color tokens
- [ ] Data table below each chart is keyboard-navigable and screen-reader accessible
- [ ] Animations disabled when `prefers-reduced-motion: reduce`
- [ ] Vitest `ng test` passes with ≥80% coverage per component
- [ ] Pattern overlay visible on each chart for colorblind accessibility
