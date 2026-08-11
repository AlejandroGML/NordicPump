# Design: Backend Proxy — NordicPump API

## Technical Approach

Greenfield Litestar (ASGI) proxy on Python 3.14. Three async ingestion pipelines parse external sources into a unified schema, persisted to a JSON file cache. A thin service layer resolves requests cache-first with stale-fallback and ingest-on-miss. The hot path reads only from cache; upstream is hit by a background scheduler or on cache miss. Maps directly to proposal capabilities `prices-api`, `data-ingestion`, `price-cache`.

**Source-grounded finding (verified live 2026-06-27):** `fuel-prices.eu/llms.txt` **and** `llms-full.txt` publish all EU prices in **EUR/L** and expose only an **EUR/USD** ECB rate — neither carries EUR→SEK/DKK/NOK. The Oil Bulletin publishes **Thursdays** (after 15:00 EET). Consequence: EUR→SEK/DKK/NOK are fetched from the **ECB daily reference API** (primary), with config rates as fallback when ECB is unreachable.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| I/O model | Async `httpx.AsyncClient` | sync `requests` | Litestar is ASGI-native; non-blocking fetch + single background refresh loop, no thread pool |
| Cache format | JSON | pickle | Human-readable/debuggable, atomic-rename friendly, no unsafe deserialization |
| Atomic writes | temp file + `os.replace` | direct overwrite | POSIX-atomic; failed/interrupted write never corrupts existing file (spec: "partial write protection") |
| Errors | Typed exception hierarchy + Litestar handlers | string/`raise Exception` | Maps to standard `{error:{code,message}}` envelope with correct status (404/503); per error-handling skill |
| Scheduler | `asyncio` background task on lifespan | APScheduler / on-demand only | KISS/YAGNI — cron-like jobs need no dep; EU **Friday**, SSB monthly, ECB daily; on-demand alone misses refresh window + adds cold-start latency |
| Currency rates | **ECB daily reference API (primary)** + config fallback | config-only / assume rate in source | llms.txt + llms-full.txt verified to carry only EUR/USD; ECB provides EUR→SEK/DKK/NOK; config fallback when ECB unreachable (spec permits) |
| ECB rates module | dedicated `ecb_rates.py` async ingester | inline in normalizer | Separates concern, independently testable, shares scheduler; feeds normalizer fresh daily rates |
| Money math | `Decimal` + `ROUND_HALF_UP` | `float` `round()` | Spec expects `1.45 × 11.50 → 16.68`; float `round(16.675,2)` gives banker's-rounding 16.67 |

## Data Flow

```
GET /api/v1/prices/{country}
   │
   ▼
price_service.resolve(country)
   ├─ file_cache.read(source) ─┬─ fresh → records        (X-Cache: HIT)
   │                           ├─ stale → try ingest
   │                           │            ├─ ok → records (X-Cache: REFRESHED)
   │                           │            └─ fail → records (X-Cache: STALE)
   │                           └─ miss → try ingest
   │                                      └─ fail → CacheMissError → 503
   ▼
filter[country] → PriceResponse → 200

ingest (scheduler | on-miss):
  fuel_prices_eu.fetch(llms.txt) ─┐   ssb.fetch(table 09654) ─┐
  (SE/DK/FI EUR prices)           │   (NO NOK prices)          │
                                  ▼                            ▼
            normalizer.normalize( rates = ecb_rates.fetch() ?? config_fallback )
                                  │
                                  ▼
                       file_cache.write()  (atomic temp + rename)
```

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `backend/app.py` | Create | Litestar app, route registration, lifespan (startup refresh + background task), exception handlers → error envelope |
| `backend/config.py` | Create | Pydantic Settings: upstream URLs (fuel-prices.eu, SSB, **ECB**), `cache_dir`, EU window 7d, SSB window 30d, fallback rates `{EUR_SEK,EUR_DKK,EUR_NOK}`, valid countries, `Retry-After` |
| `backend/models/price.py` | Create | `FuelType`, `Country` enums; `PriceRecord`, `PriceResponse`, cache-file wrapper |
| `backend/models/errors.py` | Create | `UpstreamError`, `CacheMissError`, `UnsupportedCountryError`, `ParseError` |
| `backend/ingestion/fuel_prices_eu.py` | Create | Async fetch + parse llms.txt table for SE/DK/FI; best-effort EUR/USD parse |
| `backend/ingestion/ecb_rates.py` | Create | Async fetch ECB daily reference rates (EUR→SEK/DKK/NOK); return rates or raise on failure |
| `backend/ingestion/ssb.py` | Create | Async fetch table 09654 JSON-stat; parse NO NOK prices; `ParseError` on dimension drift |
| `backend/ingestion/normalizer.py` | Create | Unify → `PriceRecord[]`; EUR→SEK/DKK/NOK via ECB rates (config fallback); `Decimal`; drop+warn on missing field |
| `backend/cache/file_cache.py` | Create | `read`, `write` (atomic), `is_fresh(source, window)` |
| `backend/services/price_service.py` | Create | `resolve(country)` cache-first/stale/miss + `X-Cache` header |
| `backend/scheduler.py` | Create | Async loop: EU weekly (**Friday**), SSB monthly, **ECB daily**; independent |
| `backend/routes/prices.py` | Create | `GET /api/v1/prices/{country}` |
| `backend/routes/health.py` | Create | `GET /health` |
| `backend/tests/` | Create | pytest unit + integration; committed sample payloads |
| `backend/pyproject.toml` | Create | litestar, httpx, pydantic-settings; dev: pytest, pytest-asyncio, respx, pytest-cov, ruff, mypy |
| `Dockerfile`, `docker-compose.yml` | Create | Multi-stage python:3.14-slim, non-root, healthcheck `/health` |

## Interfaces / Contracts

```python
class FuelType(str, Enum): EURO_95 = "euro_95"; DIESEL = "diesel"
class Country(str, Enum): SE="SE"; DK="DK"; FI="FI"; NO="NO"

class PriceRecord(BaseModel):
    country: Country
    fuel: FuelType
    price_eur: Decimal
    price_native: Decimal
    price_native_currency: str      # "EUR" (SE,FI) | "DKK" (DK) | "NOK" (NO)
    price_sek: Decimal              # price_eur * EUR_SEK (Decimal, ROUND_HALF_UP)
    date: date
    frequency: str                  # "weekly" (EU) | "monthly" (NO)

class PriceResponse(BaseModel):
    country: Country
    prices: list[PriceRecord]

# Cache file: { "cached_at": "<ISO-8601>", "records": [PriceRecord, ...] }
```

Error responses: `{ "error": { "code": "...", "message": "..." } }` — `UNSUPPORTED_COUNTRY` (404), `SERVICE_UNAVAILABLE` (503 + `Retry-After: 300`). `X-Cache` header: `HIT` | `STALE` | `REFRESHED`.

## Testing Strategy (Strict TDD)

| Layer | What | Approach |
|-------|------|----------|
| Unit | parsers, normalizer, file_cache, price_service, scheduler | pytest; **one test per spec scenario**; `Decimal` rounding assertions (`1.45×11.50→16.68`) |
| Integration | routes + service + Litestar client | Litestar `AsyncTestClient`; assert status, body, `X-Cache`, `Retry-After` |
| Mocking | upstream HTTP, filesystem | `respx` for fuel-prices.eu + SSB + **ECB**; `tmp_path` cache; committed `tests/fixtures/*.txt` + `*.json` samples |

Scenario→test map: `test_fallback_rate_on_missing_ecb`, `test_ecb_unreachable_falls_back_to_config_rates`, `test_corrupt_cache_not_overwritten_on_disk_full`, `test_cold_start_returns_503`, `test_stale_cache_served_on_upstream_failure`, `test_ssb_schema_drift_raises_parse_error`, `test_unsupported_country_404`, `test_weekly_refresh_skips_when_fresh`.

## Migration / Rollout

Greenfield — no DB, no migration. Rollback = revert `backend/` deploy (per proposal); zero frontend blast radius. Cache files are container-local ephemeral.

## Resolved Decisions (was: Open Questions)

- [x] **Rates source of truth** → ECB daily reference API is primary (scope change from config-only); config rates remain fallback when ECB is unreachable. New `ecb_rates.py` module.
- [x] **llms-full.txt content** → verified live: only EUR/USD present, no EUR→SEK/DKK/NOK — same conclusion as llms.txt. ECB ingestion confirmed necessary.
- [x] **SE `price_native`** → confirmed: `price_native = price_eur` (EUR) for SE and FI (SEK served via `price_sek`, no duplication); DK → `price_eur × EUR_DKK`; NO → native NOK from SSB.
- [x] **Refresh day** → changed from Monday to **Friday** (fuel-prices.eu publishes Thursdays after 15:00 EET; Friday catches freshest data).
