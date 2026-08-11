# Tasks — Dashboard Chart Components

> **Delivery Strategy**: force-chained, stacked-to-main
> **Line Budget**: 400 per PR
> **Total Estimated Lines**: ~700 (additions only)
> **Decision needed before apply**: No
> **Chained PRs recommended**: Yes
> **400-line budget risk**: High

## Chain Layout

```
main ← tracker (draft) ← PR#1 ← PR#2 ← PR#3 ← PR#4 ← PR#5 ← PR#6
         ▲
     all children target previous child, not tracker directly
```

## Phase 1: Foundation (PR #1) — Shared Chart Infrastructure

### 1.1 Install chart.js dependency
- [x] `cd frontend && pnpm add chart.js`
- [x] Verify peer deps compatible with Angular 22

### 1.2 Create ChartConfigService
- [x] `frontend/src/app/shared/chart-config/chart-config.service.ts`
- [x] Set `Chart.defaults.font.family = 'Fira Code'`
- [x] Set `Chart.defaults.color = '#1E3A8A'` (text token)
- [x] Color map: `low: '#16A34A', mid: '#F59E0B', high: '#DC2626'`
- [x] `getAnimationConfig()`: returns `{ duration: 600, easing: 'easeOutQuart' }` or `{ duration: 0 }` if `prefers-reduced-motion`
- [x] `getPattern(band, ctx)`: creates offscreen canvas patterns, caches in Map
- [x] Unit tests: `chart-config.service.spec.ts` — motion preference detection, pattern creation, color map

### 1.3 Create Pattern Overlay Plugin
- [x] `frontend/src/app/shared/chart-config/pattern-overlay.plugin.ts`
- [x] Chart.js plugin with `id: 'patternOverlay'`
- [x] `beforeDraw`: apply cached patterns as fill for bar datasets
- [x] Register via `Chart.register(patternPlugin)`
- [x] Unit tests: plugin hooks, pattern application

### 1.4 Create Chart Test Mocks
- [x] `frontend/src/test-setup.ts`: add canvas mock (minimal `getContext`, `createPattern`, `fillRect`)
- [x] Verify `ng test` runs without canvas errors

**Verification**: `ng test --watch=false` passes. `ChartConfigService` tests green. Pattern plugin registered.

---

## Phase 2: price-chart (PR #2)

### 2.1 Scaffold component
- [x] `ng generate component shared/price-chart --standalone`
- [x] Imports: `CommonModule`, `SkeletonLoaderComponent`, `TranslateModule`

### 2.2 Implement HTTP data fetch
- [x] Inject `HttpClient`, `CountryStateService`
- [x] `effect(() => service.selectedCountry())` → triggers `loadPrices(country)`
- [x] Loading/error/empty states as signals

### 2.3 Implement Chart.js rendering
- [x] Build Chart.js `config` from API data: line chart, two datasets (Euro 95, Diesel)
- [x] Apply `ChartConfigService` defaults (font, colors, animation)
- [x] Apply pattern overlay for colorblind
- [x] `new Chart(canvasRef, config)` in `AfterViewInit`

### 2.4 Implement data table
- [x] `<table>` below canvas: date | fuel | price (SEK) | EUR
- [x] Keyboard-navigable, `scope` attributes on headers
- [x] Canvas `aria-describedby` linked to table `id`

### 2.5 Tests
- [x] Unit: component creates Chart with correct config from mock data
- [x] Unit: loading state renders skeleton
- [x] Unit: error state renders Retry button
- [x] A11y: table has proper roles and attributes

**Verification**: Swedish price chart renders with animation, data table accessible.

---

## Phase 3: neighbor-compare (PR #3)

### 3.1 Scaffold + HTTP
- [x] `ng generate component shared/neighbor-compare --standalone`
- [x] `forkJoin([se$, dk$, fi$, no$])` to fetch all 4 countries
- [x] Handle partial failures (render available countries, placeholder for failed)

### 3.2 Implement sorted bar chart
- [x] Sort cheapest→most expensive by `price_sek`
- [x] Horizontal bar chart with country labels (flags + names)
- [x] Price-band color coding per DESIGN.md
- [x] Pattern overlay on bars

### 3.3 Data table
- [x] `<table>` listing country | fuel | SEK price | EUR | color band
- [x] Sorted same order as chart

### 3.4 Tests
- [x] Unit: sorting logic verified
- [x] Unit: partial failure renders placeholder
- [x] Unit: all 4 countries render correctly

---

## Phase 4: tax-breakdown (PR #4)

### 4.1 Scaffold + HTTP
- [x] `ng generate component shared/tax-breakdown --standalone`

### 4.2 Implement stacked bar chart
- [x] Parse `price_breakdown` from API response if present
- [x] Fallback: derive from raw price using Swedish reference rates
- [x] Stacked bar: product cost (chart-low), excise (chart-mid), VAT (accent), other (secondary)
- [x] Stagger animation: `100ms * index` delay per bar (500ms total per bar)

### 4.3 Derivation logic
- [x] Document source: `Energimyndigheten` reference rates
- [x] Show note when derived vs actual

### 4.4 Data table + tests
- [x] Table: fuel | Product | Excise | VAT | Other taxes
- [x] Tests: stacked config, stagger delay, derivation fallback

---

## Phase 5: seasonality-chart (PR #5)

### 5.1 Scaffold + HTTP
- [x] `ng generate component shared/seasonality-chart --standalone`

### 5.2 Implement trend line chart
- [x] Group API data by month
- [x] Line chart with two series (Euro 95, Diesel)
- [x] Highlight seasonal peaks with tooltip annotations
- [x] `borderDash` per dataset for colorblind differentiation
- [x] Handle <3 months data: informational message, no chart

### 5.3 Data table + tests
- [x] Table: month | Euro 95 price | Diesel price
- [x] Tests: grouping logic, insufficient data message, peak annotation

---

## Phase 6: Dashboard Integration (PR #6)

### 6.1 Wire charts into dashboard grid
- [x] `frontend/src/app/features/dashboard/dashboard.component.ts`
- [x] Import all 4 chart components
- [x] 2-column responsive grid (Tailwind: `grid grid-cols-1 lg:grid-cols-2 gap-6`)
- [x] Layout order: price-chart top-left, neighbor-compare top-right, tax-breakdown bottom-left, seasonality-chart bottom-right

### 6.2 Integration tests
- [x] Dashboard renders all 4 chart placeholders (skeleton loaders)
- [x] Country change propagates to price-chart, tax-breakdown, seasonality-chart
- [x] Neighbor-compare unaffected by country change (always shows all 4)

### 6.3 Responsive verification
- [x] Mobile: stacked single column, horizontal scroll tables
- [x] Tablet: 2-column grid
- [x] Desktop: 2-column grid, max-w container

**Verification**: `ng test --watch=false` passes with ≥80% coverage. Dashboard renders 4 charts.

---

## Summary

| PR | Lines (est) | Tests | Deliverable |
|----|------------|-------|-------------|
| #1 | ~100 | 8 | ChartConfigService + Pattern Plugin |
| #2 | ~120 | 10 | price-chart component |
| #3 | ~110 | 8 | neighbor-compare component |
| #4 | ~130 | 10 | tax-breakdown component |
| #5 | ~120 | 8 | seasonality-chart component |
| #6 | ~100 | 5 | Dashboard grid wiring |
| **Total** | **~680** | **49** | 4 chart components in dashboard |

**Test command**: `cd frontend && npx ng test --watch=false`
**Build command**: `cd frontend && npx ng build --configuration production`
**Coverage threshold**: 80%
