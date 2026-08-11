# Tasks: Tank Calculator

> **Review Workload Forecast**
> - **Decision needed before apply**: No
> - **Chained PRs recommended**: No
> - **400-line budget risk**: Low
> - **Rationale**: Single component (~150 LOC) + spec (~200 LOC) + i18n (~42 lines per language, ~250 LOC total across 6 files) + dashboard wiring (~5 LOC). Total ≈ 650 changed lines across two reviewable commits. Under 400-line budget when split: PR #1 (i18n keys) ≈ 250 LOC, PR #2 (component + spec + wiring) ≈ 400 LOC.

## Phase 1: i18n Keys

### 1.1 Add `dashboard.tank.*` keys to all language files
- [x] Add 11 keys to `public/assets/i18n/en.json`
- [x] Add 11 keys to `public/assets/i18n/sv.json`
- [x] Add 11 keys to `public/assets/i18n/da.json`
- [x] Add 11 keys to `public/assets/i18n/nb.json`
- [x] Add 11 keys to `public/assets/i18n/fi.json`
- [x] Add 11 keys to `public/assets/i18n/es.json`

**Keys**:
```json
"tank": {
  "title": "Tank Calculator",
  "liters": "Tank size (liters)",
  "inputLabel": "Tank capacity in liters",
  "cost": "Filling {liters}L costs",
  "vs": "vs",
  "native": "in {currency}",
  "savings": "You save {amount} kr with {fuel}",
  "noSaving": "Same price for both fuels",
  "error": "Could not calculate cost",
  "noPrice": "Price data not available",
  "retry": "Retry calculation"
}
```

## Phase 2: TankCalculatorComponent (TDD)

### 2.1 RED — write failing spec for component core behavior
- [x] Create `tank-calculator.component.spec.ts`
- [x] Test: component creates with default 50L
- [x] Test: slider input updates tankLiters signal
- [x] Test: number input updates tankLiters signal, clamps on blur
- [x] Test: cost calculation for mocked API response
- [x] Test: savings delta shown with correct cheaper fuel
- [x] Test: native currency displayed via `{'in'} {currency}` pattern
- [x] Verify FAIL (no component file yet)

### 2.2 GREEN — implement TankCalculatorComponent
- [x] Create `tank-calculator.component.ts`
- [x] Inject `HttpClient`, `TranslateService`, `CountryStateService`
- [x] `tankLiters` signal (default 50)
- [x] `prices` signal for API response
- [x] `loading`, `error` signals for state
- [x] `effect()` on `CountryStateService.selectedCountry()` → fetch prices
- [x] `loadPrices(country)` method → `HttpClient.get<PriceResponse>(...)`
- [x] Computed: `euro95CostSek`, `dieselCostSek`, `euro95CostNative`, `dieselCostNative`
- [x] Computed: `savingsAmount`, `cheaperFuelLabel`
- [x] `formatSek()`, `formatNative()` using `Intl.NumberFormat`
- [x] `onSliderInput(event)`, `onNumberInput(event)`, `onNumberBlur(event)` handlers
- [x] Slider + number input dual synced via `(input)` events
- [x] Inline template with loading/error/calculated states
- [x] Verify GREEN

### 2.3 REFACTOR — clean up
- [x] Extract `clampLiters(value: number): number` pure function
- [x] Ensure functions < 50 lines (coding-standards)
- [x] Verify still GREEN

### 2.4 Accessibility + responsive tests
- [x] Test: `aria-live="polite"` on cost container
- [x] Test: `aria-busy="true"` during loading
- [x] Test: input has `<label>` with `for`/`id` association
- [x] Test: slider, input, retry button meet 44×44px minimum
- [x] Test: keyboard Tab reaches all interactive elements
- [x] Test: visible focus ring on focus

## Phase 3: Dashboard Integration

### 3.1 Wire into dashboard
- [x] Import `TankCalculatorComponent` in `DashboardComponent`
- [x] Add `<app-tank-calculator />` to dashboard template in a card section
- [x] Add section heading using `'dashboard.tank.title' | translate`
- [x] Verify component renders in dashboard grid

### 3.2 Integration validation
- [ ] Manual: select different countries, verify prices update
- [ ] Manual: drag slider, verify costs recalculate instantly
- [ ] Manual: type in number input, verify slider syncs
- [ ] Manual: resize viewport, verify responsive layout
- [ ] Run full test suite: `ng test --watch=false`

## Phase 4: Verify

### 4.1 Coverage check
- [ ] Run `ng test --watch=false --code-coverage`
- [ ] Confirm ≥ 80% line coverage for `tank-calculator.component.ts`

### 4.2 PWA check
- [ ] `ng build --configuration production` succeeds
- [ ] Lighthouse audit: no regressions in Performance or Accessibility

---

## Commit Plan (Work-Unit Strategy)

| PR | Scope | ~LOC | Commit message |
|----|-------|------|----------------|
| PR #1 | i18n keys (6 files) | ~250 | `feat(i18n): add tank calculator translation keys to all 6 languages` |
| PR #2 | Component + spec + wiring | ~400 | `feat(dashboard): add tank calculator with slider input and cost comparison` |

PR #2 includes: `tank-calculator.component.ts`, `.spec.ts`, `dashboard.component.ts` (wiring).

Follows work-unit-commits: each PR is self-contained, reviewable, and rollback-safe.
