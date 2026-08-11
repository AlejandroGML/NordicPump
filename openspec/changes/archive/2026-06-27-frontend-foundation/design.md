# Design: Frontend Foundation — NordicPump Angular PWA

## Technical Approach

Standalone-first Angular 22 app bootstrapped via `bootstrapApplication`. Tailwind v4 integrated through PostCSS (`.postcssrc.json`), with design tokens living in `DESIGN.md` (single source of truth) and mapped into a CSS `@theme` block — **no `tailwind.config.js`** (Tailwind v4 is CSS-first). Routes are language-prefixed (`/:lang/dashboard`) with `loadComponent` lazy loading. PWA via `@angular/service-worker` with `appUpdateMode: prompt`. i18n via `@ngx-translate/core` + `TranslateHttpLoader`. All verified against Angular official docs (Context7) and the three capability specs (pwa-setup, i18n-setup, layout-shell).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Component model | **Standalone** | NgModules | Angular 17+ default; by v22 NgModules are legacy. Fewer files, `bootstrapApplication`, tree-shakeable `loadComponent`. |
| Test runner | **Karma + Jasmine** | Jest | Angular default; matches `config.yaml` verify command (`ng test --browsers=ChromeHeadless`). `jest-preset-angular` has ESM/zoneless friction with recent Angular. Strict TDD works fine with `ng test --watch`. |
| Tailwind integration | **PostCSS + CSS `@theme`** | JS config / `@tailwindcss/angular` builder | Context7-confirmed official path: `.postcssrc.json` → `@tailwindcss/postcss`. Tailwind v4 is CSS-first; theme tokens go in `@theme {}`. |
| Tokens source | **DESIGN.md → CSS** | Hardcoded hex | design-system skill generated + validated DESIGN.md (0 errors, WCAG AA). Export to `@theme`. |
| SW update strategy | **Prompt** (visible banner) | Auto-update | Spec requires "freshness banner on all cached views." `appUpdateMode: prompt` surfaces the banner and gives the user control. |
| SW API strategy | **performance (SWR, 24h)** | freshness | Spec: stale-while-revalidate, 24h. Data is weekly/monthly — staleness is acceptable with a date banner. |
| Routing | **`/:lang` parent + lazy children** | Per-route lang param | One guard, one TranslateLoader cycle per lang change. Easier redirect logic. |
| i18n loading | **TranslateHttpLoader** (eager per-lang JSON) | Build-time inlining | Each `assets/i18n/{lang}.json` fetched on language change; cacheable by SW (7d). |

## Data Flow

```
browser ──(navigate /sv/dashboard)──► [LangGuard: resolve lang]
   │                                       │
   │                            localStorage │ navigator.language │ sv
   │                                       ▼
   ├──► TranslateHttpLoader ──fetch──► assets/i18n/sv.json (SW cache 7d)
   │
   ├──► loadComponent(DashboardComponent) ──lazy──► router-outlet
   │
   └──► ServiceWorker intercepts /api/v1/prices/* ──SWR 24h──► backend:8000
                                                            (litestar proxy)
```

Offline: SW serves cached shell + last-known prices → header shows freshness banner with data date (`X-Cache` + response date).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/` | Create | Angular 22 project (`ng new nordic-pump --routing --style=scss --strict --standalone`) |
| `frontend/src/main.ts` | Create | `bootstrapApplication(AppComponent, appConfig)` — provideRouter, provideServiceWorker, provideHttpClient, TranslateModule |
| `frontend/src/app/app.routes.ts` | Create | `/:lang` parent + lazy `loadComponent` children (dashboard, about) |
| `frontend/src/app/core/guards/lang.guard.ts` | Create | Detection chain: localStorage → navigator → sv; redirect to valid `/:lang/*` |
| `frontend/src/app/core/services/lang.service.ts` | Create | Persists lang to localStorage, drives `translate.use()` + `html[lang]`/`[dir]` |
| `frontend/src/app/layout/app.component.ts` | Create | Shell: `<app-header>` + `<router-outlet>` + `<app-footer>` |
| `frontend/src/app/layout/header/header.component.ts` | Create | Logo, nav, `<app-language-switcher>`; mobile drawer |
| `frontend/src/app/layout/footer/footer.component.ts` | Create | Copyright + fuel-prices.eu / SSB attribution (`rel="noopener noreferrer"`) |
| `frontend/src/app/shared/language-switcher/*.ts` | Create | 6 options, native names, preserves route suffix |
| `frontend/src/styles.scss` | Create | `@import "tailwindcss";` + `@theme {}` mapping DESIGN.md tokens + reset + font imports |
| `frontend/.postcssrc.json` | Create | `{ "plugins": { "@tailwindcss/postcss": {} } }` |
| `frontend/src/assets/i18n/{sv,da,nb,fi,en,es}.json` | Create | Nested component-scoped keys |
| `frontend/ngsw-config.json` | Create | dataGroups: api SWR 24h, i18n/assets cache-first 7d/30d; `appUpdateMode: prompt` |
| `frontend/public/manifest.webmanifest` | Create | theme_color #1E40AF, scope /, start_url /sv/dashboard, 192+512 icons |
| `frontend/src/manifest.webmanifest` + icons | Create | Maskable icons 192/512 |
| `DESIGN.md` | Create | Validated design tokens (this phase) |

## Interfaces / Contracts

```typescript
// core/models/lang.ts
type SupportedLang = 'sv' | 'da' | 'nb' | 'fi' | 'en' | 'es';
const SUPPORTED_LANGS: SupportedLang[] = ['sv','da','nb','fi','en','es'];
const LANG_NATIVE_NAMES: Record<SupportedLang, string> = {
  sv:'Svenska', da:'Dansk', nb:'Norsk bokmål', fi:'Suomi', en:'English', es:'Español'
};
const DEFAULT_LANG: SupportedLang = 'sv';
const LANG_STORAGE_KEY = 'np_lang';
```

Backend contract (already built, `backend/routes/prices.py`): `GET /api/v1/prices/{se|dk|fi|no}` → `{ country, prices: [{ fuel, price_sek, price_native, ... }] }`, header `X-Cache`. Foundation phase does NOT call it — SW strategy assumes it exists.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | LangGuard detection chain, LangService persistence, LanguageSwitcher | Jasmine + TestBed, 4 detection scenarios from spec |
| Unit | Header/Footer render, nav links, attribution `rel` attrs | TestBed, `RouterTestingModule` |
| Unit | Tailwind token application (`bg-primary` → #1E40AF) | Component harness + computed style assertion |
| Integration | Route navigation `/sv/dashboard` → correct loader + dir attr | `RouterTestingHarness` |
| E2E (planned) | Offline SW behavior, 6-language routes | Playwright (post-foundation) |
| TDD | Strict — RED→GREEN→REFACTOR for every component/guard | `ng test --watch` |

Coverage target: 80% (per `config.yaml`). All 33 spec scenarios map to unit/integration tests.

## Migration / Rollout

Greenfield — no migration. Rollback: `rm -rf frontend/ DESIGN.md` (zero backend impact, no DB). The backend `/api/v1/prices/*` contract is already built and unaffected.

## Open Questions

- [ ] PWA icons source: generate from a logo, or use a text-based placeholder for the foundation phase and add real branding later? (Non-blocking — placeholder 512px icon satisfies Lighthouse.)
- [ ] Font loading: self-host Fira Sans/Fira Code (better offline/SW caching) vs Google Fonts CDN? Recommend self-host for PWA offline guarantee — confirm preference.
