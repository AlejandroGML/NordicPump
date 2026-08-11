# Proposal: Dashboard Tools — Tank Calculator

## Intent

NordicPump users need to estimate real-world fuel costs. A tank-calculator that multiplies current API prices by a user-adjustable tank size (1-200L) turns raw price-per-liter data into actionable "what I'll pay" insight. Shows SEK cost and native-currency cost for both Euro 95 and Diesel, with a savings comparison between fuel types.

## Scope

### In Scope
- **tank-calculator** — Adjustable tank size input (slider 1-200L + synced number field, default 50L), cost display for Euro 95 and Diesel in SEK and native currency, savings-delta between fuels
- **i18n keys** — 7 new translation keys across all 6 languages (sv, da, nb, fi, en, es)

### Out of Scope
- Fuel efficiency (L/100km) or distance-based calculation
- Multi-vehicle tank profiles
- Historical price trends within calculator

## Capabilities

### New Capabilities
- `tank-calculator`: Tank fill cost comparison widget with adjustable liter input, SEK + native currency display, and fuel savings delta. Reacts to `CountryStateService`.

### Modified Capabilities
None — this is a net-new component. Consumes `prices-api` (read-only) and `CountryStateService` without changing their contracts.

## Approach

- Standalone Angular component in `shared/tank-calculator/`
- Consumes `CountryStateService.selectedCountry()` signal via `effect()` → fetches `GET /api/v1/prices/{country}` with `HttpClient`
- Tank size: dual-input (range slider 1-200 + number input), two-way synced via signal
- Multiplies `price_sek` and `price_native` by tank liters → displays formatted SEK/native totals
- Computes savings: `| euro95_cost_sek - diesel_cost_sek |` with fuel label
- Follows `price-current` pattern: direct `HttpClient`, `TranslateService` for i18n, `SkeletonLoaderComponent` for loading
- Design tokens: Nordic card (`bg-surface`, `border-hairline`, `rounded-lg`, `padding-5`), Fira Code for prices, 44px touch targets

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/shared/tank-calculator/` | New | Component, spec, all files |
| `frontend/public/assets/i18n/{lang}.json` | Modified | 7 new `dashboard.tank.*` keys per language |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Modified | Wire `app-tank-calculator` into dashboard grid |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Price format mismatch (native vs SEK) confuses users | Low | Clearly label each value; native currency shown as subtitle |
| Slider + number input sync edge cases (e.g., manual entry > 200) | Low | Clamp input to 1-200 range on blur |
| i18n string review for 6 languages | Low | Use translator-neutral keys; English base, native speakers for correction later |

## Rollback Plan

Remove `shared/tank-calculator/` directory. Revert dashboard imports. Translation keys remain inert if unused. No API or other component changes.

## Dependencies

- `CountryStateService` (existing signal)
- `HttpClient` → `GET /api/v1/prices/{country}` (existing endpoint)
- `SkeletonLoaderComponent` (existing shared)
- `TranslateService` / `TranslatePipe` (existing i18n)

## Success Criteria

- [ ] Tank size slider and number input stay synced within 1-200L range
- [ ] Costs displayed in SEK and native currency for both fuel types
- [ ] Savings delta shown with correct fuel label and SEK value
- [ ] Component reacts to country changes (new fetch, recalculate)
- [ ] Loading, error, and no-data states handled with translated strings
- [ ] All interactive elements meet 44×44px touch target minimum
- [ ] Vitest coverage ≥ 80% for the component
