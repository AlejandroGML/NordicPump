# Tasks: Frontend Foundation — Angular 22 PWA

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400 custom + ~1000 generated (scaffold) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold + Tailwind + Design Tokens | PR 1 | Base: main. ng new + PostCSS + @theme mapping |
| 2 | i18n Core (types, service, guard, routes, translation files) | PR 2 | Base: main (after PR 1). ~150 custom lines |
| 3 | Layout Shell (AppComponent, header, footer, lang switcher) | PR 3 | Base: main (after PR 2). ~120 custom lines |
| 4 | PWA Config (manifest, SW config, icons, install prompt) | PR 4 | Base: main (after PR 3). ~80 custom lines |

## Phase 1: Scaffold + Tailwind + Design Tokens

- [x] 1.1 Run `ng new nordic-pump --routing --style=scss --strict --standalone`; review generated files
- [x] 1.2 Install Tailwind v4 + create `.postcssrc.json` with `@tailwindcss/postcss`
- [x] 1.3 Create `styles.scss`: `@import "tailwindcss"` + `@theme {}` block mapping DESIGN.md tokens (colors, fonts, spacing, rounded)
- [x] 1.4 Verify token application: `bg-primary` → `#1E40AF`, `font-sans` → Fira Sans

## Phase 2: i18n Setup

- [x] 2.1 Create `core/models/lang.ts` — `SupportedLang` type, `SUPPORTED_LANGS`, `LANG_NATIVE_NAMES`, `DEFAULT_LANG`
- [x] 2.2 Create `core/services/lang.service.ts` — localStorage persistence, `translate.use()`, `html[lang]`/`[dir]` updates
- [x] 2.3 Create `core/guards/lang.guard.ts` — detection chain: localStorage → navigator.language → sv; redirect to `/:lang/*`
- [x] 2.4 Create `app.routes.ts` — `/:lang` parent with lazy `loadComponent` children (dashboard, about)
- [x] 2.5 Create `assets/i18n/{sv,da,nb,fi,en,es}.json` with component-scoped keys (header.nav.dashboard, footer.copyright)

## Phase 3: Layout Shell

- [x] 3.1 Create `layout/app.component.ts` — shell with `<app-header>` + `<router-outlet>` + `<app-footer>` (inline template in app.ts)
- [x] 3.2 Create `layout/header/header.component.ts` — logo, nav links, language switcher; sticky; mobile drawer <768px
- [x] 3.3 Create `layout/footer/footer.component.ts` — copyright, fuel-prices.eu + SSB attributions with `rel="noopener noreferrer"`
- [x] 3.4 Create `shared/language-switcher/language-switcher.component.ts` — 6 native-name options, preserves route suffix

## Phase 4: PWA Configuration

- [x] 4.1 Create `manifest.webmanifest` — name, theme_color #1E40AF, bg #F8FAFC, standalone, scope /, start_url /sv/dashboard
- [x] 4.2 Generate PNG icons (192×192, 512×512 maskable) + add to manifest
- [x] 4.3 Create `ngsw-config.json` — app shell cache-first 7d, API SWR 24h, i18n cache-first 7d, icons cache-first 30d
- [x] 4.4 Create install prompt component — `beforeinstallprompt` after 3rd view, suppress if already installed
