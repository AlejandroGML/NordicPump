# Tasks: Dashboard Core Components

## Chain Strategy: Stacked to Main

5 stacked PRs, each independent. Order: foundation → leaf components → integration.

```
PR #1: country-state     → main (dep: none)
PR #2: skeleton-loader   → main (dep: none)
PR #3: kpi-card          → main (dep: none)
PR #4: country-selector  → main (dep: PR #1)
PR #5: price-current     → main (dep: PR #1, PR #2, PR #3)
     + dashboard wiring
```

## Phase 1 — Foundation (PR #1)

### 1.1 CountryStateService
- [x] Create `frontend/src/app/core/services/country-state.service.ts`
- [x] Export `Country` type: `'SE' | 'DK' | 'FI' | 'NO'`
- [x] Define `selectedCountry` writable signal, default `'SE'`
- [x] Red test → green → refactor

**Verification:** `ng test --watch=false` — signal initializes to SE, `set()` updates value

## Phase 2 — Leaf Components (PRs #2, #3)

### 2.1 Skeleton Loader (PR #2)
- [x] Create `frontend/src/app/shared/skeleton-loader/skeleton-loader.component.ts`
- [x] `@Input() variant: 'text' | 'card' | 'circle'` (default: `'text'`)
- [x] `@Input() width`, `height`, `rounded`, `label`
- [x] Tailwind `animate-pulse` on `surface-muted` bg
- [x] `@media (prefers-reduced-motion: reduce)` → `animation: none`
- [x] `aria-busy="true"`, `role="status"`
- [x] Red test → green → refactor per variant

**Verification:** All 3 variants render, reduced-motion mock disables animation, `aria-busy` present

### 2.2 KPI Card (PR #3)
- [x] Create `frontend/src/app/shared/kpi-card/kpi-card.component.ts`
- [x] `@Input() title: string`, `value: string`, `subtitle?: string`, `trend?: 'up' | 'down' | 'neutral'`
- [x] `@Input() variant?: 'solid' | 'glass'`
- [x] Value in Fira Code mono, title in `body-sm` `text-subtle`
- [x] Trend arrow: ↑ red, ↓ green, → gray
- [x] Design token compliance: no hardcoded hex
- [x] Red test → green → refactor

**Verification:** Full/partial KPI renders, trend arrows correct, glass variant has blur backdrop

## Phase 3 — Country Selector (PR #4)

### 3.1 Country Selector Component
- [x] Create `frontend/src/app/shared/country-selector/country-selector.component.ts`
- [x] Inject `CountryStateService`
- [x] `@Input() variant: 'dropdown' | 'buttons'` (default: `'buttons'`)
- [x] `@Output() countrySelected = output<Country>()`
- [x] 4 countries: SE, DK, FI, NO with inline SVG flags
- [x] Selected country → `primary` bg; others → `surface`
- [x] On select: write to `CountryStateService`, emit via `countrySelected`
- [x] Red test → green → refactor

**Verification:** 4 flags rendered, selection emits + writes to service, keyboard nav works, ARIA roles present

## Phase 4 — Price Display & Integration (PR #5)

### 4.1 PriceCurrent Component
- [x] Create `frontend/src/app/shared/price-current/price-current.component.ts`
- [x] Inject `HttpClient`, `CountryStateService`
- [x] `effect()`: on `selectedCountry` change → `GET /api/v1/prices/{country}`
- [x] Parse `PriceResponse`, extract Euro 95 + Diesel records
- [x] Format SEK: `new Intl.NumberFormat('sv-SE', ...)`
- [x] Map `price_eur` to color band: `<1` → `chart-low`, `1-3` → `chart-mid`, `>3` → `chart-high`
- [x] Trend calc: if 2+ weeks of data exist, compare current to previous week
- [x] Loading state: render `app-skeleton-loader` (card variant × 2)
- [x] Error state: translated message + retry button
- [x] `aria-live="polite"` on price container
- [x] Red test → green → refactor

**Verification:** Prices render in SEK, color bands correct, trend arrows show when data available, loading→data transition works, error+retry works

### 4.2 Dashboard Integration
- [x] Update `DashboardComponent` template with country selector + price current
- [x] No logic changes needed (components self-contained)
- [x] Update i18n keys in `sv.json` (add `dashboard.price.*` keys)
- [x] Copy to all 6 language files

**Verification:** Dashboard renders selector + prices, country change updates prices, e2e smoke test with `ng serve`

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated total lines (source + tests) | ~350 |
| **400-line budget risk** | **Medium** |
| **Chained PRs recommended** | **Yes** |
| **Decision needed before apply** | **No** — user pre-accepted stacked-to-main |

**PR Boundaries & Budgets:**

| PR | Files | Est. Lines | Budget |
|----|-------|-----------|--------|
| #1 country-state | 1 service + test | ~40 | ✅ |
| #2 skeleton-loader | 1 component + test | ~60 | ✅ |
| #3 kpi-card | 1 component + test | ~80 | ✅ |
| #4 country-selector | 1 component + test + flag SVGs | ~90 | ✅ |
| #5 price-current + wire | 1 component + test + i18n | ~80 | ✅ |

Each PR under 100 lines — well within 400-line budget. Stacked-to-main ensures clean diffs.
