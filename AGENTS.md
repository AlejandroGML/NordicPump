# AGENTS.md — NordicPump

NordicPump: mobile-first PWA comparing fuel prices across SE/DK/FI/NO/IS.
Angular 22 frontend + Litestar (Python 3.14) backend proxy/cache. No database.

> Sources of truth: `ARCHITECTURE.md` (stack, data flow, all features),
> `DESIGN.md` (visual tokens), `PLAN.md`, `openspec/specs/*` (feature specs),
> `nordicpump-redesign.html` (visual design prototype — the target look).

## Commands

Backend (from `backend/`, venv at `backend/.venv`):

- Run API: `.venv/bin/uvicorn app:create_app_from_env --factory --host 0.0.0.0 --port 8000`
  (run from `backend/`; settings read from env vars — see `config.py`)
- Tests: `.venv/bin/pytest -m unit` · `-m integration` · plain `pytest` for all
  (markers `unit`/`integration`; async tests auto via pytest-asyncio)
- Lint: `.venv/bin/ruff check .` (line-length 120, select E,F,I,N,W,UP)
- Format: `.venv/bin/ruff format .`
- Types: `.venv/bin/mypy` (strict; tests excluded in pyproject)

Frontend (from `frontend/`, pnpm only — NEVER npm):

- Dev server: `pnpm start` → http://localhost:4200 (proxies `/api` → :8000 via `proxy.conf.json`)
- Tests: `pnpm test` (vitest 4 via Angular unit-test builder, jsdom; setup in `src/test-setup.ts`)
  Single file: `pnpm test -- --include src/path/to/file.spec.ts`
- Build: `pnpm build` (PWA — service worker from `ngsw-config.json`)

Local dev stack: start backend first, then frontend. NO deploy — local only.

## Architecture

Backend (`backend/`): Litestar app assembled in `app.py` (`create_app_from_env`
for uvicorn --factory). File-based JSON cache (`cache/`, atomic writes, per-country
indices). In-process async scheduler in the lifespan: EU ingests Sunday (fuel APIs publish weekly snapshots then), SSB on
new month + 15th (publish day), Iceland when stale (2-day window, gasvaktin), ECB daily (`scheduler.py` + `cadence/`). Routes: `health.py`,
`prices.py` (GET /api/v1/prices/{country}), `rates.py` (GET /api/v1/rates). Iceland: gasvaktin gas.json (national average, 245 stations), EUR→ISK via open.er-api.com + fallback.

Frontend (`frontend/src/app/`): standalone components, signals, OnPush.
`core/` = services (CurrencyService, PriceApiService, ThemeService) + guards;
`features/` = dashboard, about; `shared/` = charts + widgets
(base-chart, kpi-card, tank-calculator, country-selector, paginator...);
`layout/` = header/footer; `pwa/` = service worker bits.
i18n: ngx-translate, 7 languages (sv default, da, nb, fi, en, es, is) in
`public/assets/i18n/*.json`. Currency auto-per-language: sv→SEK, da→DKK,
nb→NOK, fi/en/es→EUR, is→ISK; manual override via CurrencySwitcher.

## Gotchas (verified)

- Chart.js: MUST destroy an existing chart before re-rendering its canvas
  ("Canvas is already in use"). BaseChartComponent handles this — keep
  `destroyChart()` before any `renderIfData()`.
- `tsc --noEmit` does NOT validate Angular templates — only `ng serve` /
  `ng build` / `pnpm test` catch template errors (private signals in
  templates, missing decorators). Always run the dev server or tests.
- ngx-translate `onLangChange` fires ONLY on switches, never for the initial
  language — read `currentLang` (a Signal) in the constructor for init logic.
- Avoid the TranslatePipe in specs (nearly impossible to mock in vitest);
  prefer getters with `translate.instant()`.
- Angular effects are lazy — ThemeService applies `data-theme` synchronously
  in constructor + setTheme, not only via an effect.
- jsdom here lacks localStorage/matchMedia/ResizeObserver — services and
  specs must be defensive (test-setup.ts stubs the latter two).
- i18n interpolation uses `{{param}}` (ngx-translate), NOT `{param}`.
- `input()` signals don't work in this vitest setup — use `@Input()/@Output()`
  in components that have specs.
- Angular 22 unit-test builder does NOT auto-load `test-setup.ts`: it must be
  declared in `angular.json` (test → options.setupFiles) AND in
  `tsconfig.spec.json` include. Do NOT call `initTestEnvironment` inside
  test-setup.ts — the builder already does ("Cannot set base providers").
- Chart.js registration lives in `chart-setup.ts` (imported from main.ts only).
  Tests import it in `test-setup.ts`, otherwise "category is not a registered
  scale" / "doughnut is not a registered controller".
- jsdom defines `navigator.language` on the instance — `vi.spyOn(Navigator.prototype, 'language')`
  silently fails; use `Object.defineProperty(window.navigator, 'language', {get: ...})`.
- Use `afterRenderEffect` (not `effect()`) to measure DOM sizes — plain effects
  run before render and read stale geometry (e.g. banner height 0).

## Countries & currencies — single source of truth

`countries.json` (repo root) is the SINGLE source of truth for country/currency
data. Generated files are marked DO NOT EDIT:

- `backend/models/countries.py` — Country enum + CountryMeta + derived maps
  (COUNTRY_SOURCE, SOURCE_WINDOW_DAYS, RATE_KEYS, VALID_COUNTRIES)
- `frontend/src/app/shared/models/country.ts` — Country type + COUNTRY_CODES
- `frontend/src/app/shared/currency-switcher/currencies.ts` — Currency type +
  CURRENCIES + CURRENCY_SYMBOLS + CURRENCY_LOCALES

**Adding a new country/currency = edit `countries.json` + run
`python scripts/generate_countries.py`** — that's it. Translation keys
(`country.X` in i18n files) and flag SVGs (`frontend/.../constants/flags.ts`)
are still manual (UI copy, type-checked by Record<Country, ...>).

## Conventions

- Conventional commits only; never add AI attribution lines.
- Pre-commit hook runs ruff + mypy + pytest + vitest (scripts/pre-commit.sh,
  installed via scripts/install-precommit.sh). Commit only when all pass.
- pnpm, never npm. Tests: AAA pattern, behavior-describing names, 80%+ target.
- i18n keys added to ALL 6 language files; UI copy in user language, code in English.
- OpenSpec workflow for features: `openspec/` (proposal → spec → tasks → apply → verify).
