# Tasks: Backend Proxy — NordicPump API

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1400–1600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units (feature-branch-chain)

| Unit | Scope | New lines | Base |
|------|-------|-----------|------|
| 1 | Foundation: models, config, errors, pyproject.toml | ~200 | feature/backend-proxy |
| 2 | Cache layer: file_cache with atomic writes | ~150 | #1 branch |
| 3 | EU Ingestion: fuel_prices_eu + normalizer + Decimal | ~350 | #2 branch |
| 4 | NO+ECB Ingestion: ssb + ecb_rates + fallback | ~300 | #3 branch |
| 5 | API assembly: service, routes, scheduler, app, Docker | ~450 | #4 branch |

## Phase 1: Foundation — Models, Config, Errors

- [x] 1.1 `models/price.py` — FuelType, Country enums; PriceRecord, PriceResponse, CacheData (RED→GREEN)
- [x] 1.2 `models/errors.py` — UpstreamError, CacheMissError, UnsupportedCountryError, ParseError (RED→GREEN)
- [x] 1.3 `config.py` — Pydantic Settings: URLs, cache_dir, fallback rates, windows, Retry-After (RED→GREEN)
- [x] 1.4 `pyproject.toml` — litestar, httpx, pydantic-settings; dev: pytest, pytest-asyncio, respx, pytest-cov, ruff, mypy

## Phase 2: Cache Layer

- [x] 2.1 `cache/file_cache.py` — read, atomic write (temp+os.replace), is_fresh() (RED→GREEN)
- [x] 2.2 Tests: fresh hit, stale, cold start, atomic write protection, corrupt/edge cases (20 tests)

## Phase 3: EU Ingestion Pipelines

- [x] 3.1 `ingestion/fuel_prices_eu.py` — async fetch+parse llms.txt; SE/DK/FI EUR prices (RED: respx→GREEN)
- [x] 3.2 `ingestion/normalizer.py` — unify records; Decimal ROUND_HALF_UP; drop+warn on missing field (RED: 1.45×11.50=16.68→GREEN)
- [x] 3.3 Tests: 5 scenarios — EU success, ECB missing (fallback), EU down, EUR→SEK conversion, missing field

## Phase 4: NO + ECB Ingestion

- [x] 4.1 `ingestion/ssb.py` — async fetch+parse JSON-stat 09654; typed ParseError on schema drift (RED: respx→GREEN)
- [x] 4.2 `ingestion/ecb_rates.py` — async fetch ECB daily EUR→SEK/DKK/NOK; raise on unreachable (RED: mock→GREEN)
- [x] 4.3 Tests: SSB (12), ECB (11), normalizer NO (6) — 29 new tests, 119 total

## Phase 5: API Assembly — Service, Routes, Scheduler, App, Docker

- [x] 5.1 `services/price_service.py` — resolve(country) cache-first with stale/miss fallback; X-Cache (RED→GREEN)
- [x] 5.2 `routes/prices.py` — GET /api/v1/prices/{country}; 404/503 typed errors (RED: AsyncTestClient→GREEN)
- [x] 5.3 `routes/health.py` — GET /health; 200 + timestamp (RED→GREEN)
- [x] 5.4 `scheduler.py` — async loop: EU Friday, SSB monthly, ECB daily (RED: cadence→GREEN)
- [x] 5.5 `app.py` — Litestar app: lifespan, routes, exception handlers → error envelope (RED: full stack→GREEN)
- [x] 5.6 Tests: 24 scenarios — service (8), routes prices (4), health (2), scheduler (4), app (5), service partial-fail (1)
- [x] 5.7 `Dockerfile` — multi-stage python:3.14-slim; non-root; healthcheck /health
- [x] 5.8 `docker-compose.yml` — backend service, env, bind mount cache dir, healthcheck

## Remediation (2026-06-27)
- [x] R1: scheduler.py — 3 independent asyncio loops: EU Friday, SSB monthly, ECB daily
- [x] R2: specs updated Monday→Friday
- [x] R3: mypy --strict clean (0 errors)
- [x] R4: ruff clean (0 errors)
- [x] R5: 156 tests passing (143 existing + 13 new scheduler)
