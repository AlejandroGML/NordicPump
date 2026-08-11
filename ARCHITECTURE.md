# NordicPump — Architecture & Features

> **Purpose:** Single source of truth for the current state of the app —
> architecture, data flow, every feature, and design implications.
> Use this to drive the visual redesign.

---

## 1. Product Vision

NordicPump is a **mobile-first PWA** that compares fuel prices across the four
Nordic countries in real time.

| Dimension | Detail |
|-----------|--------|
| Countries | 🇸🇪 Sweden · 🇩🇰 Denmark · 🇫🇮 Finland · 🇳🇴 Norway · 🇮🇸 Iceland |
| Fuels | Euro 95 (Bensin 95) · Diesel |
| Languages | sv (default) · da · nb · fi · en · es · is |
| Currencies | SEK · DKK · NOK · EUR · ISK (auto per language, manual override) |
| Platform | PWA (installable, offline-capable, mobile-first) |

**What the user gets:** pick a country → see current prices, historical trends,
neighbor comparison, tax breakdown, tank-cost calculator, and seasonal patterns.
All in their language and currency.

---

## 2. Tech Stack

```
Frontend:  Angular 22 (standalone, signals, OnPush) + Chart.js + Tailwind
           + ngx-translate (6 languages) + @angular/service-worker (PWA)
Backend:   Python 3.14 + Litestar (async ASGI) + httpx + Pydantic
Cache:     File-based JSON (atomic writes, per-country indices)
Data:      fuel-prices.eu (EU Oil Bulletin) + SSB Statbank (Norway) + ECB rates
Graph:     graphify 0.8.39 (EXTRACTED-only knowledge graph, 1068 nodes)
```

**No database.** Cache is file-based. No Redis, no Celery. The scheduler runs
in-process via `asyncio.gather` in the Litestar lifespan.

---

## 3. Architecture Overview

### 3.1 Backend — Layered (Python / Litestar)

```
backend/
├── app.py                    # Litestar assembly + lifespan (scheduler + CORS)
├── config.py                 # Pydantic Settings (URLs, windows, fallback rates)
├── scheduler.py              # 3 async loops: EU (Sunday — fuel APIs publish weekly) · SSB (monthly + 15th publish day) · ECB (daily)
├── cadence/
│   └── __init__.py           # is_friday() · is_new_month() — pure domain helpers
├── routes/
│   ├── health.py             # GET /health
│   ├── prices.py             # GET /api/v1/prices/{country} → PriceResponse
│   └── rates.py              # GET /api/v1/rates → EUR→SEK/DKK/NOK
├── services/
│   ├── ingestion_pipeline.py # Fetch + normalize + cache (refresh, get_rates)
│   └── price_query.py        # Cache-first resolve (HIT / STALE / REFRESHED)
├── cache/
│   ├── cache_store.py        # Atomic JSON I/O + per-country indices
│   └── cache_freshness.py    # Time-window freshness checks
├── ingestion/
│   ├── fuel_prices_eu.py     # Parse llms.txt → SE/DK/FI raw records
│   ├── ssb.py                # Parse JSON-stat → NO raw records
│   ├── ecb_rates.py          # Fetch + parse ECB XML → EUR rates
│   └── normalizer.py         # Raw → PriceRecord (currency conversions)
└── models/
    ├── price.py              # PriceRecord · PriceResponse · Country · FuelType
    └── errors.py             # AppError → UpstreamError · CacheMissError · ParseError
```

**Data flow (cache-first):**
```
GET /api/v1/prices/SE
  → PriceQueryService.resolve(SE)
    → CacheFreshness.is_fresh("fuel-prices-eu", 7d)?
      → YES: read country index → sort desc → PriceResponse (X-Cache: HIT)
      → NO:  IngestionPipeline.refresh() → re-ingest EU → read → (X-Cache: REFRESHED)
      → MISS + upstream down: → CacheMissError → 503 (X-Cache: STALE fallback)
```

### 3.2 Frontend — Standalone Components (Angular 22)

```
frontend/src/app/
├── app.ts                    # Root shell: header + <router-outlet> + footer
├── core/
│   ├── services/
│   │   ├── country-state.service.ts   # Country signal (SE default)
│   │   ├── price-data-host.service.ts # Country → components broadcast
│   │   ├── price-api.service.ts       # HTTP + in-flight dedup (5→1 req)
│   │   ├── currency.service.ts        # Currency signal + EUR conversion
│   │   └── lang.service.ts            # Language detection chain
│   └── routes/                        # /:lang/dashboard · /:lang/about
├── shared/
│   ├── base-chart/
│   │   └── base-chart.component.ts    # @Directive abstract: chart lifecycle
│   ├── error-state/                   # Reusable error+retry block
│   ├── table-paginator/               # Pagination (10 rows/page)
│   ├── kpi-card/                      # Presentational price card
│   ├── skeleton-loader/               # Loading skeleton
│   ├── country-selector/              # Button group + dropdown variants
│   ├── language-switcher/             # Language select
│   ├── currency-switcher/             # Currency select
│   ├── price-current/                 # Latest price KPIs + trend arrows
│   ├── tank-calculator/
│   │   ├── tank-calculator.service.ts # Pure EUR-base computations
│   │   └── tank-calculator.component.ts # Slider + costs view
│   ├── chart-config/
│   │   └── chart-config.service.ts    # Colors · patterns · animation · bandForPrice
│   ├── constants/
│   │   ├── cache-keys.ts              # sessionStorage key
│   │   └── flags.ts                   # flagSvg() — shared SVG generator
│   ├── formatters/
│   │   ├── currency.ts                # formatSek · formatEur · formatNative
│   │   └── date.ts                    # parseDateUtc (UTC-safe)
│   └── models/
│       ├── country.ts                 # type Country = 'SE'|'DK'|'FI'|'NO'
│       └── price.ts                   # PriceRecord · PriceResponse (typed)
├── features/
│   ├── dashboard/
│   │   ├── dashboard.component.ts     # Page shell: sections + @defer + onboarding
│   │   ├── price-chart.component.ts   # Line chart + table (paginated)
│   │   ├── neighbor-compare.component.ts # Bar chart: 4 countries ranked
│   │   ├── tax-breakdown.component.ts    # Stacked bar: product/excise/VAT
│   │   └── seasonality-chart.component.ts # Line chart: monthly trends
│   └── about/
│       └── about.component.ts
├── layout/
│   ├── header/header.component.ts     # Logo + nav + lang + currency switchers
│   └── footer/footer.component.ts
└── pwa/
    ├── freshness-banner.component.ts  # "Showing cached data from {date}"
    ├── install-prompt.component.ts    # PWA install CTA
    └── offline-fallback.component.ts  # Offline error page
```

**Key architectural patterns:**
- **OnPush everywhere** (20 components) + Angular signals
- **BaseChartComponent** (`@Directive`) — shared chart lifecycle, i18n refresh,
  currency re-render, error/loading state. 4 charts inherit from it.
- **TankCalculatorService** — pure computation (EUR base), component is thin view
- **Contract test** (`price.contract.spec.ts`) — validates frontend `price.ts`
  matches backend `price.py` field-by-field + enum values. Prevents schema drift.
- **In-flight dedup** — 5 dashboard components subscribing to the same country
  share ONE HTTP request (Map<Country, Observable> + shareReplay refCount + finalize)

### 3.3 The Contract (backend ↔ frontend)

No shared code — different runtimes. Sync enforced by **price.contract.spec.ts**:

| Backend (Python)             | Frontend (TypeScript)             |
|------------------------------|-----------------------------------|
| `models/price.py`            | `shared/models/price.ts`          |
| `Country(StrEnum)`           | `type Country` (from country.ts)  |
| `FuelType(StrEnum)`          | `'euro_95' \| 'diesel'`           |
| `PriceRecord(BaseModel)`     | `interface PriceRecord`           |
| `PriceResponse(BaseModel)`   | `interface PriceResponse`         |

Fields: `country · fuel · price_eur · price_native · price_native_currency ·
price_sek · date · frequency`

---

## 4. Features (Current State)

### 4.1 Country Selector
- 4 Nordic countries with inline SVG flags (`flagSvg()` shared generator)
- Selected country writes to `CountryStateService` signal
- Variants: buttons (default) / dropdown
- Keyboard nav (arrow keys) + swipe (touch)
- **Design need:** flag rendering quality, selected state prominence

### 4.2 Price Current (KPI Cards)
- Shows latest Euro 95 + Diesel prices for selected country
- KPI cards with trend arrows (up=red, down=green, neutral=gray)
- Trend compares previous load for same country
- "Updated: {date}" timestamp
- All values in **active currency** (converts from EUR base)
- **Design need:** card hierarchy, trend visual weight, currency symbol clarity

### 4.3 Tank Calculator
- Adjustable tank size (1–200L) via slider + number input (synced)
- Computes fill cost for Euro 95 + Diesel in active currency
- Shows native currency as secondary
- Savings comparison: "You save X kr with {cheaper fuel}"
- **Logic in TankCalculatorService** (EUR base), component is pure view
- **Design need:** slider UX, dual-column layout on desktop

### 4.4 Price History Chart
- Line chart: Euro 95 + Diesel price over time (Chart.js)
- Accessible data table below (paginated 10 rows/page)
- Columns: Date · Fuel · Price (active currency) · EUR
- UTC-safe date parsing (`parseDateUtc`)
- Pattern overlay for colorblind a11y
- **Design need:** chart/table proportion, pagination controls

### 4.5 Neighbor Comparison
- Horizontal bar chart comparing Euro 95 across all 4 countries
- Sorted cheapest → most expensive
- Price-band color coding (bandForPrice: <€1 green · €1–3 amber · >€3 red)
- Partial failure handling (shows available countries)
- **Design need:** bar chart aesthetics, "unavailable" state

### 4.6 Tax Breakdown
- Stacked bar chart: product cost / excise duty / VAT / other
- Derived from Swedish reference rates (55% / 25% / 20%)
- Note: "Estimated from reference rates"
- **Design need:** stacked bar legibility, legend placement

### 4.7 Seasonality Chart
- Line chart: monthly average prices grouped by month
- Multi-year support (shows year in label when >1 year of data)
- "Insufficient data" message when <3 months history
- Months fully translated (6 languages)
- **Design need:** multi-line clarity, month label rotation

### 4.8 Language Switcher
- 6 languages: Svenska · Dansk · Norsk bokmål · Suomi · English · Español
- Select dropdown (desktop) / mobile menu
- Navigates preserving route suffix (`/sv/dashboard` → `/en/dashboard`)
- All UI strings translated (onboarding, chart labels, aria-labels, months)
- **Design need:** language indicator prominence

### 4.9 Currency Switcher
- 4 currencies: SEK · EUR · DKK · NOK
- **Auto-sets on language change:** sv→SEK, da→DKK, nb→NOK, fi/en/es→EUR
- **Manual override** respected until next language change
- Converts ALL displayed prices from EUR base using ECB rates
- Rates fetched from `GET /api/v1/rates` (real ECB rates, fallback on failure)
- **Design need:** currency selector placement, symbol display

### 4.10 PWA Features
- **Install prompt** — beforeinstallprompt event, CTA banner
- **Offline fallback** — dedicated offline page
- **Freshness banner** — "Showing cached data from {date}" when >24h stale
- **Service worker** — ngsw-config with stale-while-revalidate
- **SEO** — sitemap, robots.txt, meta tags per language
- **Design need:** install CTA aesthetics, offline page, freshness banner

### 4.11 Layout Shell
- **Header:** logo + nav + language + currency switchers, country badge, online indicator
- **Footer:** copyright, data source attribution, links
- **Dashboard:** responsive grid (1 col mobile / 2 col desktop for charts)
- Collapsible chart sections (mobile)
- Back-to-top button (mobile, appears after 300px scroll)
- Skip-to-content link for a11y
- **Design need:** header density, mobile hamburger UX, grid rhythm

---

## 5. Data Model

### PriceRecord (backend Pydantic / frontend interface)
| Field | Type | Description |
|-------|------|-------------|
| `country` | Country (SE/DK/FI/NO) | Country code |
| `fuel` | FuelType (euro_95/diesel) | Fuel type |
| `price_eur` | Decimal/number | Price in EUR (universal base) |
| `price_native` | Decimal/number | Price in local currency |
| `price_native_currency` | string | Currency code (SEK/DKK/EUR/NOK) |
| `price_sek` | Decimal/number | Price in SEK (legacy, still served) |
| `date` | date/string | ISO date (YYYY-MM-DD) |
| `frequency` | string | "weekly" (EU) or "monthly" (NO) |

### API Endpoints
| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | `{status, timestamp}` |
| GET | `/api/v1/prices/{country}` | `PriceResponse` + `X-Cache` header |
| GET | `/api/v1/rates` | `{base: "EUR", rates: {SEK, DKK, NOK}}` |

### Cache Headers
- `X-Cache: HIT` — fresh cache served
- `X-Cache: STALE` — stale cache served (upstream failed)
- `X-Cache: REFRESHED` — upstream re-ingested on demand
- `Retry-After: 300` — on 503 (config-driven)

---

## 6. User Flows

### Primary Flow (Dashboard)
```
User loads /:lang/dashboard
  → Language + currency auto-detected
  → Country SE pre-selected
  → Price cards load (latest prices)
  → Tank calculator loads (50L default)
  → Scroll down → @defer triggers chart loading:
    → Price History (line + table)
    → Neighbor Comparison (bar)
    → Tax Breakdown (stacked bar)
    → Seasonality (line)
```

### Country Switch
```
User clicks country button (e.g. Norway)
  → CountryStateService signal updates
  → All components re-fetch via PriceApiService (dedup in-flight)
  → Charts destroy + re-render with new data
  → Currency stays the same (unless language also changes)
```

### Language Switch
```
User selects language (e.g. English)
  → Route navigates to /en/dashboard
  → TranslateService loads en.json
  → All components refresh i18n labels
  → Currency auto-sets to EUR (en→EUR)
  → Charts destroy + re-render (currency may have changed)
```

### Currency Switch
```
User selects currency (e.g. DKK)
  → CurrencyService signal updates
  → All displayed prices re-convert from EUR base
  → Charts re-render with new axis labels
  → Manual override respected until next language change
```

---

## 7. Design System Reference

> See `DESIGN.md` for the complete token spec (colors, typography, spacing, components).

### Color Tokens
| Token | Hex | Semantic |
|-------|-----|----------|
| `primary` | `#1E40AF` | Deep Nordic blue — headers, buttons |
| `secondary` | `#3B82F6` | Links, chart accents |
| `accent` | `#F59E0B` | CTAs (sparingly), on-accent is dark text |
| `chart-low` | `#16A34A` | Price < €1 |
| `chart-mid` | `#F59E0B` | Price €1–3 |
| `chart-high` | `#DC2626` | Price > €3 |
| `chart-vat` | `#3B82F6` | VAT bars (tax breakdown) |
| `chart-other` | `#64748B` | Other taxes (tax breakdown) |
| `chart-unavailable` | `#94A3B8` | No data bars |

### Typography
- **Fira Sans** — body, headings, UI (humanist, open counters)
- **Fira Code** — prices, tabular data (monospaced, `tabular-nums`)

### A11y Requirements
- WCAG AA minimum
- Touch targets ≥ 44×44px
- Chart pattern overlays for colorblind users
- `aria-live` on price regions
- `prefers-reduced-motion` respected (600ms → 0ms)

---

## 8. What's Done vs What's Missing

### ✅ Done
- Backend: full pipeline (ingestion, cache, scheduler, rates endpoint)
- Frontend: all 11 features functional
- 6 languages fully translated
- Currency selector (4 currencies, auto per language)
- PWA (install, offline, freshness, service worker)
- Contract test (anti-drift)
- OnPush + signals + BaseChartComponent
- 381 frontend tests + 167 backend tests
- Knowledge graph (graphify, 1068 nodes EXTRACTED)

### 🔲 Missing / Future
- Visual redesign (what you're about to do)
- Deploy to Fly.io (Docker Compose ready)
- Real per-country request cache with TTL (in-flight dedup works, but no persistent cache)
- i18n: currency selector aria-labels are hardcoded English
- Arabic (RTL) support — architecture is ready, content not

---

## 9. Quick Reference for Design

**The app has these visual zones (top to bottom):**

1. **Header** — logo, nav, language switcher, currency switcher, country badge
2. **Onboarding banner** — dismissible, first-visit only
3. **H1 title** — app name
4. **Country selector** — 4 flag buttons
5. **Price cards** — 2 KPI cards (Euro 95 + Diesel) with trend + currency
6. **Tank calculator** — slider + 2 cost cards + savings line
7. **Price history** — line chart + paginated table
8. **Neighbor comparison** — horizontal bar chart + table
9. **Tax breakdown** — stacked bar chart + table
10. **Seasonality** — line chart + table (or "insufficient data")
11. **Footer** — copyright, data sources

**Grid:** mobile = 1 column; desktop = 2 columns for charts (charts side by side).

**Data density:** this is a data tool, not a marketing page. Tables and charts
are the product — they need to be legible, not decorative.

**Responsive breakpoints:** 375 · 768 · 1024 · 1440px. No horizontal scroll.
