# Proposal: Frontend Foundation — NordicPump Angular PWA

## Intent

Bootstrap the NordicPump Angular 22 PWA with i18n, offline support, and base layout shell. Foundation for all 10 MVP components. Standalone-first app replacement quality — not a "website with manifest." Future: Capacitor/TWA wrappers for native stores.

## Scope

### In Scope
- Angular 22 scaffold (`ng new nordic-pump --routing --style=scss --strict`)
- PWA: `@angular/pwa`, manifest, service worker with stale-while-revalidate strategy (API cache maxAge 24h, freshness indicator when offline)
- i18n: `ngx-translate` with 6 languages (sv, da, nb, fi, en, es), route-prefixed (`/sv/dashboard`, `/en/dashboard`), detection: localStorage → navigator.language → sv fallback
- Tailwind CSS with design tokens from PLAN.md (#1E40AF primary, #3B82F6 secondary, #F59E0B accent, #F8FAFC bg, #1E3A8A text, Fira Sans/Fira Code)
- Base layout shell: header (logo, nav links, language switcher), footer (copyright, data source attribution to fuel-prices.eu + SSB)
- App shell + splash screen for standalone install

### Out of Scope
- Dashboard components (price-current, kpi-card, charts, country-selector, etc.)
- API integration (calling `/api/*` endpoints — service worker strategy assumes they exist)
- Animations, Capacitor/TWA wrappers, DESIGN.md generation, content pages

## Capabilities

### New Capabilities
- `pwa-setup`: PWA manifest, service worker (stale-while-revalidate), app shell, splash screen, install prompt
- `i18n-setup`: ngx-translate with 6 languages, route prefixes, language detection fallback chain
- `layout-shell`: Header/footer/base layout with navigation structure and Tailwind design tokens

### Modified Capabilities

None — greenfield frontend. Existing specs (data-ingestion, price-cache, prices-api) are backend-only.

## Approach

1. Scaffold Angular 22 with routing, SCSS, strict TypeScript
2. Add `@angular/pwa` → customize manifest (theme_color: #1E40AF, scope: /, start_url: /sv/dashboard)
3. Install `ngx-translate` → configure `TranslateHttpLoader`, lazy-loaded route prefixes per language
4. Install Tailwind → `tailwind.config.js` with PLAN.md tokens, `@tailwindcss/postcss`
5. Build shell: RouterOutlet with lazy feature modules, header/footer components, placeholder routes for Dashboard + About

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/` | New | Angular 22 project root |
| `frontend/src/assets/i18n/` | New | Translation JSON (sv, da, nb, fi, en, es) |
| `openspec/specs/pwa-setup/` | New | New capability spec |
| `openspec/specs/i18n-setup/` | New | New capability spec |
| `openspec/specs/layout-shell/` | New | New capability spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Angular 22 + Tailwind PostCSS compatibility | Low | Angular 19+ supports PostCSS natively; verify `@tailwindcss/postcss` |
| Route prefix conflicts with PWA scope | Medium | `scope: /`, `start_url: /sv/dashboard`; test offline navigation |
| Stale API cache showing outdated prices | Low | `maxAge: 86400`; freshness banner on all cached views |

## Rollback Plan

- `rm -rf frontend/` — clean removal, zero backend impact
- Revert `openspec/specs/{pwa-setup,i18n-setup,layout-shell}/` if specs were created
- No database, no migrations, no backend changes

## Dependencies

- Node.js ≥20 + Angular CLI 22
- Backend proxy (`backend/` — already built, not required for foundation phase but SW strategy references `/api/*`)

## Success Criteria

- [ ] `ng serve` starts without errors
- [ ] Lighthouse PWA audit passes (installable, 100% PWA score)
- [ ] All 6 language routes render correct translations (`/sv/dashboard`, `/en/dashboard`, etc.)
- [ ] Service worker caches app shell, responds offline (DevTools → Offline)
- [ ] Language detection: localStorage > navigator.language > sv fallback
- [ ] Tailwind tokens: correct primary (#1E40AF), accent (#F59E0B) on shell
