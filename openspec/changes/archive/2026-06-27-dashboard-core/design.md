# Design: Dashboard Core Components

## Architecture Overview

```
DashboardComponent (feature shell, lazy-loaded)
├── app-country-selector (shared)
├── app-price-current (shared)
│   └── app-skeleton-loader (shared)
│   └── app-kpi-card (shared) × 2
└── app-kpi-card (shared) × N
```

All components are **standalone**. No shared module. Imports declared per-component.

## Component Tree & Data Flow

```
CountryStateService (signal: selectedCountry)
        │
        ├──► country-selector ── writes ──► selectedCountry.set(country)
        │
        └──► price-current ── reads ──► selectedCountry()
                    │
                    ├── HttpClient.get(/api/v1/prices/{country})
                    │       │
                    │       ▼
                    │   PriceResponse { prices: PriceRecord[] }
                    │       │
                    │       ├──► Euro 95 → app-kpi-card
                    │       └──► Diesel  → app-kpi-card
                    │
                    └── (loading) → app-skeleton-loader × 2
```

### CountryStateService

```typescript
@Injectable({ providedIn: 'root' })
class CountryStateService {
  selectedCountry = signal<Country>('SE');
  setCountry(c: Country): void { this.selectedCountry.set(c); }
}
```

Simple, no persistence to localStorage in MVP (data source always SE by default).

## API Integration

**Endpoint:** `GET /api/v1/prices/{country}`  
**Response type:** `PriceResponse` — exported from backend Pydantic model, mirrored as TypeScript interface:

```typescript
interface PriceResponse {
  country: 'SE' | 'DK' | 'FI' | 'NO';
  prices: PriceRecord[];
}

interface PriceRecord {
  fuel: 'euro_95' | 'diesel';
  price_sek: number;
  price_eur: number;         // for color banding
  price_native: number;
  price_native_currency: string;
  date: string;              // ISO-8601
  frequency: string;
}
```

**Error handling:**
- `404` → "Country not supported" — display translated error, retry button
- `503` → "Service unavailable" — display with `Retry-After` header hint
- Network error → generic offline/retry state

## Design Token Mapping

| Component | Token | Value |
|-----------|-------|-------|
| kpi-card | `surface` bg | #FFFFFF |
| kpi-card | `hairline` border | #E2E8F0 |
| kpi-card title | `text-subtle` | #64748B |
| price-current value | `Fira Code` mono | — |
| price band <1 EUR | `chart-low` | #16A34A |
| price band 1-3 EUR | `chart-mid` | #F59E0B |
| price band >3 EUR | `chart-high` | #DC2626 |
| country-selector active | `primary` bg | #1E40AF |
| skeleton | `surface-muted` bg | #F1F5F9 |

## ADR: Signal-based State over NgRx

**Decision:** Use Angular signals (`signal()`) for `CountryStateService` instead of NgRx store.

**Rationale:**
- 1 piece of shared state (selected country) — NgRx is overkill
- Angular signals are native, no dependency, tree-shakeable
- `effect()` handles side effects (triggering API calls) cleanly
- Reducible to NgRx later if state complexity warrants it

## ADR: Standalone Components

**Decision:** All 4 components use `standalone: true`. No shared NgModule.

**Rationale:**
- Angular 22 default — the ecosystem has moved
- Tree-shaking: unused components produce zero bundle cost
- Easier lazy-load boundaries in future
- Matches existing pattern in the codebase (DashboardComponent is standalone)

## Animation & Motion

- Skeleton: Tailwind `animate-pulse` → `animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`
- `@media (prefers-reduced-motion: reduce)` → `animation: none`
- Price updates: CSS transition `color 300ms ease` for band changes
- Country selector: Tailwind `transition-colors duration-200` on active state

## Testing Strategy (TDD)

| Component | Test focus |
|-----------|-----------|
| CountryStateService | Signal reads/writes, default value |
| skeleton-loader | Variants render, motion media query mock, aria-busy |
| kpi-card | Inputs → DOM, trend arrows, glass variant, clickable focus |
| country-selector | Selection emits, service writes, keyboard nav, flag SVGs present |
| price-current | HTTP mock (HttpTestingController), price formatting, color bands, trend calc, loading/error states |
| DashboardComponent | Integration: select country → price fetch → render |

Test runner: `ng test --watch=false` (Karma/Jasmine per existing config). Vitest not yet configured — deferred to future task if `ng test` proves slow.

## Review Workload Forecast

- **Estimated changed lines:** 300-400 (4 components × 50-80 lines, 1 service × 30 lines, tests × 2-3x source)
- **400-line budget risk:** Medium
- **Chained PRs recommended:** Yes (stacked-to-main: country-selector → kpi-card → skeleton-loader → price-current → dashboard wiring)
- **Decision needed before apply:** Yes — user accepted `stacked-to-main` chain strategy
