# Proposal: Backend Proxy — NordicPump API

## Intent
Unified REST API normalizing multi-source Nordic fuel prices (fuel-prices.eu for SE/DK/FI, SSB Statbank for NO) into a single JSON schema. Litestar proxy with file-based cache.

## Scope

### In Scope
- Litestar proxy: fetch, parse, normalize two external data sources
- `/api/v1/prices/{country}` endpoint
- File cache with weekly Monday refresh (fuel-prices.eu) + monthly refresh (SSB)
- ECB reference rate from fuel-prices.eu llms.txt for EUR→SEK conversion
- `price_native` (DKK/NOK) + `price_sek` in unified response schema
- 503 on cold start with no cache and upstream unreachable
- Health check endpoint `/health`

### Out of Scope
- Frontend integration (Angular app — separate change)
- Redis cache layer (deferred post-MVP)
- Auth / rate limiting (internal proxy only)
- Historical price storage (future time-series DB)
- Admin panel / manual cache invalidation UI

## Capabilities

### New Capabilities
- `prices-api`: REST endpoint `/api/v1/prices/{country}` returning normalized fuel prices per country with both SEK and native currency (DKK/NOK)
- `data-ingestion`: Fetch + parse fuel-prices.eu/llms.txt (SE/DK/FI, weekly) and SSB Statbank table 09654 (NO, monthly)
- `price-cache`: File-based JSON cache per source. Weekly Monday refresh for EU data; monthly for SSB. Stale fallback when upstream fails.

### Modified Capabilities
None — greenfield project.

## Approach
Python 3.14 + Litestar thin proxy. Two ingestion pipelines: (1) text parser for fuel-prices.eu extracting ECB rates for EUR→SEK, (2) JSON-stat client for SSB Norway. Normalizer produces unified records: `{ country, fuel, price_eur, price_native, price_sek, date, frequency }`. Cache stored as JSON files per source. API reads cache; returns 503 if cache file missing and upstream unreachable.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `backend/app.py` | New | Litestar entry point, routes, startup |
| `backend/ingestion/` | New | Source fetchers + parsers |
| `backend/cache/` | New | File cache read/write layer |
| `backend/models/` | New | Pydantic price schemas |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| fuel-prices.eu format change | Medium | Schema validation; alert on parse fail; stale cache |
| SSB JSON-stat complexity | Medium | Focused parser; only table 09654 fields |
| Upstream downtime | Low | Stale cache with `X-Cache: STALE` |
| ECB rate unavailable in llms.txt | Low | Fallback: hardcoded config rate |

## Rollback Plan
Revert `backend/` deployment. Frontend has no dependency yet — zero blast radius. Cache files are container-local; no data migration needed.

## Dependencies
- Python 3.14 + Litestar (in PLAN.md stack)
- External: `https://www.fuel-prices.eu/llms.txt`
- External: `https://data.ssb.no/api/v0/en/table/09654`

## Success Criteria
- [ ] `GET /api/v1/prices/se` returns Swedish prices (Euro 95 + Diesel)
- [ ] `GET /api/v1/prices/no` returns Norwegian prices from SSB
- [ ] `price_native` (DKK/NOK) + `price_sek` both present per country
- [ ] ECB reference rate from llms.txt used for EUR→SEK conversion
- [ ] Cold start + no cache + upstream down → `503 Service Unavailable`
- [ ] Cache persists across restarts; weekly Monday refresh for EU data
