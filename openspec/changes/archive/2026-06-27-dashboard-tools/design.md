# Design: Tank Calculator

## Architecture Decision

**Decision**: Standalone Angular component in `shared/tank-calculator/`, following the `price-current` component pattern (direct `HttpClient`, signal-based state, `effect()` for reactivity).

**Rationale**: The tank-calculator is a self-contained widget with no child components (beyond shared skeletons). It fits the existing `shared/` pattern. No new service is needed — the computation logic is component-local.

**Alternatives considered**: Extracting a `TankCalculatorService` — rejected as YAGNI. There's no shared computation surface beyond this component, and the pattern is simple enough for inline logic.

## Component Structure

```
shared/tank-calculator/
├── tank-calculator.component.ts   # Component logic
└── tank-calculator.component.spec.ts  # Vitest suite
```

### Inline Template Strategy

Template is inline (matches `price-current`, `kpi-card` patterns in the codebase). No external HTML file.

### State Machine

```
loading → [fetch success] → calculated (display costs)
        → [fetch error]   → error (message + retry)
        → [empty prices]  → empty (no-data message)
```

States re-enter `loading` on country change.

## Sequence: Country Change → Cost Update

```
User taps DK        CountrySelector    CountryStateService   TankCalculator    HttpClient    API
  |                       |                    |                   |               |          |
  |--select(DK)---------->|                    |                   |               |          |
  |                       |--setCountry(DK)--->|                   |               |          |
  |                       |                    |--signal update--->|               |          |
  |                       |                    |                   |--effect()     |          |
  |                       |                    |                   |--loading=true |          |
  |                       |                    |                   |--GET /api/... |          |
  |                       |                    |                   |               |--200 OK->|
  |                       |                    |                   |<--prices[]----|          |
  |                       |                    |                   |--compute()    |          |
  |                       |                    |                   |--render costs |          |
  |<======================cost displayed============================================|          |
```

## Data Flow

```
Inputs:  CountryStateService.selectedCountry() [signal]
         tankLiters [signal, default 50]

Compute: Prices from API × tankLiters
         - euro95CostSek  = price_sek × liters
         - dieselCostSek  = price_sek × liters
         - euro95Native   = price_native × liters
         - dieselNative   = price_native × liters
         - savings         = |euro95CostSek - dieselCostSek|
         - cheaperFuel     = euro95CostSek < dieselCostSek ? 'Euro 95' : 'Diesel'

Output:  Formatted strings (Intl.NumberFormat sv-SE for SEK)
```

## Slider + Input Sync

- **Source of truth**: `tankLiters` signal (writable)
- **Slider**: `<input type="range" min="1" max="200" step="1" [value]="tankLiters()">`
- **Number input**: `<input type="number" min="1" max="200" [value]="tankLiters()">`
- **Sync flow**: Both inputs bind to `tankLiters` signal. On slider `(input)` → `tankLiters.set(value)`. On number input `(input)` → `tankLiters.set(value)`. On `(blur)` → clamp to [1,200].
- **Fix for stale signal**: Use `(input)` event, not `(change)` — fires per keystroke/thumb drag. For number input, debounce is not needed (single value, no expensive re-fetch).

## Layout

```
┌─────────────────────────────────────┐
│  Tank Calculator          (h3)      │
│                                     │
│  Tank size (liters)      (label)    │
│  [===========◉=========] (slider)   │
│  [   50   ]              (input)    │
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  Euro 95          Diesel            │
│  725,00 kr        810,00 kr   (h2)  │
│  in SEK           in SEK     (sub)  │
│  ≈ 500,00 kr.     ≈ 558,00 kr.      │
│  in DKK           in DKK            │
│                                     │
│  ─────────────────────────────────  │
│  You save 85,00 kr with Euro 95     │
│                                     │
└─────────────────────────────────────┘
```

Mobile (375px): single column, labels above values
Desktop (≥1024px): two-column cost cards side by side

## Design Token Mapping

| Element | Token | Value |
|---------|-------|-------|
| Card bg | `bg-surface` | `#FFFFFF` |
| Card border | `border-hairline` | `#E2E8F0` |
| Card radius | `rounded-lg` | `12px` |
| Card padding | `p-5` | `20px` |
| Heading | `text-h2` or `text-h3` | 24px/20px Fira Sans 600/500 |
| Price values | `font-mono`, `text-display` | Fira Code 40px |
| Slider track | `bg-primary` / `accent-color: #1E40AF` | |
| Slider thumb | `accent-color: #F59E0B` | |
| Savings highlight | `text-chart-low` (#16A34A) or plain `text-text` | |
| Error text | `text-text-muted` | `#475569` |
| Retry button | `bg-primary`, `text-on-primary`, `rounded-md` | |
| Input field | `bg-surface`, `border-hairline-strong`, `rounded-md` | |

## Animation

No animation required. Price numbers update instantly on input change. Loading → calculated transition uses the shared `SkeletonLoaderComponent` fade pattern already in the codebase.

## Test Strategy (TDD)

| Test category | Scope |
|--------------|-------|
| Slider-input sync | Verify signal updates on both `(input)` events; clamp on blur |
| Cost calculation | Mock API response, verify SEK/native computed correctly |
| Savings delta | Verify cheaper fuel label and SEK difference |
| Country react | Change `CountryStateService` signal; verify new fetch triggered |
| States | Loading (skeleton visible), error (message + retry button), empty (no-price message) |
| Accessibility | Check `aria-live`, `aria-busy`, label `for`/`id`, 44px touch targets |
| Responsive | Programmatic viewport resize, verify layout classes |
| Design tokens | Snapshot/check CSS classes for card, slider colors, font-mono on prices |

Mock strategy: `HttpTestingController` from `@angular/common/http/testing` for API; `CountryStateService` instantiated in `TestBed` with initial value; `TranslateService` via `ngx-translate` `TranslateModule.forRoot()`.
