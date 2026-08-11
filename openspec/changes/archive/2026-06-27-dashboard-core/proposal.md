# Proposal: Dashboard Core Components

## Intent

Deliver the 4 foundation dashboard components that form the visual core of NordicPump: live price display, reusable KPI card, country selector, and skeleton loading states. All standalone Angular components consuming the existing `GET /api/v1/prices/{country}` backend.

## Scope

### In Scope
- **price-current**: Display current Euro 95 + Diesel prices for selected country. Large numbers, SEK formatting, trend arrow vs last week
- **kpi-card**: Reusable card component. Props: title, value, subtitle, trend. Nordic-minimalist style with glassmorphism option
- **country-selector**: Flag + country name control for SE/DK/FI/NO. Emits selection, stores in `CountryStateService`
- **skeleton-loader**: Pulse animation for API loading states. Respects `prefers-reduced-motion`
- **CountryStateService**: Signal-based shared service for selected country state

### Out of Scope
- Chart components (price-chart, seasonality-chart, neighbor-compare)
- Tax breakdown, tank calculator
- Backend changes (API exists)

## Capabilities

### New Capabilities
- `price-current`: Live fuel price display with currency formatting, trend indicators, and color-coded price bands
- `kpi-card`: Reusable KPI metric card with title, value, subtitle, trend, and Nordic design tokens
- `country-selector`: Country selection UI with flag display, dropdown/button-group UX, app-wide state via signal service
- `skeleton-loader`: Accessible loading skeleton with pulse animation and reduced-motion respect

### Modified Capabilities
None — existing specs (layout-shell, i18n-setup, pwa-setup, prices-api) unchanged.

## Approach

1. Create `CountryStateService` (signal-based) — single `selectedCountry` writable signal
2. Build `skeleton-loader` first (zero deps) — Tailwind `animate-pulse`, `@media (prefers-reduced-motion)` check
3. Build `kpi-card` — standalone, `@Input()` title/value/subtitle/trend, Tailwind card tokens
4. Build `price-current` — inject `HttpClient` + `CountryStateService`, fetch on country change, format with `Intl.NumberFormat('sv-SE')`, color-code per DESIGN.md price bands
5. Build `country-selector` — emit selected country, write to `CountryStateService`, flag SVG inline
6. Wire into `DashboardComponent` — replace placeholder template

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/shared/price-current/` | New | Price display component + tests |
| `frontend/src/app/shared/kpi-card/` | New | Reusable KPI card + tests |
| `frontend/src/app/shared/country-selector/` | New | Country selector + tests |
| `frontend/src/app/shared/skeleton-loader/` | New | Skeleton loader + tests |
| `frontend/src/app/core/services/country-state.service.ts` | New | Signal-based country state |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Modified | Wires 4 components |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CORS blocking `/api/v1/prices/*` in dev | Med | Configure Angular proxy or Litestar CORS middleware |
| `Intl.NumberFormat` SEK rounding | Low | Use `minimumFractionDigits: 2`, test with known values |
| `prefers-reduced-motion` not detected in test | Low | Mock `window.matchMedia` in TestBed |

## Rollback Plan

- Revert `DashboardComponent` template to placeholder (1 file edit)
- Components are additive — no shared state mutation. `rm -rf` component dirs cleans completely
- `CountryStateService` can remain (no-op until removed from providers)

## Dependencies

- Backend running (`/api/v1/prices/{country}` returns `PriceResponse`)
- Angular `HttpClient` (already in `appConfig`)
- Tailwind (already in project)
- `ngx-translate` (already in project)

## Success Criteria

- [ ] `price-current` renders SEK-formatted Euro 95 + Diesel prices for selected country
- [ ] `kpi-card` renders title, value (mono font), subtitle, and optional trend arrow
- [ ] `country-selector` emits selected country, updates `CountryStateService`, triggers price fetch
- [ ] `skeleton-loader` pulses on load, disappears on data arrival, static when `prefers-reduced-motion`
- [ ] All 4 components accessible: 44×44px touch targets, `aria-live` on price, keyboard navigable
- [ ] 80%+ test coverage per component (strict TDD)
