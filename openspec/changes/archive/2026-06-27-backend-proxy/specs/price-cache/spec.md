# Delta for price-cache

## ADDED Requirements

### Requirement: Cache read

The system MUST read normalized prices from JSON cache files keyed by source (e.g., `cache/fuel-prices-eu.json`, `cache/ssb-no.json`).

#### Scenario: Fresh cache hit

- GIVEN `cache/fuel-prices-eu.json` exists and `cached_at` is within 7 days
- WHEN cache layer reads EU data
- THEN records are returned and response includes `X-Cache: HIT`

#### Scenario: Stale cache fallback on upstream failure

- GIVEN cache is older than refresh window AND upstream fetch fails
- WHEN cache layer reads data
- THEN stale cached data SHALL be returned with `X-Cache: STALE`

#### Scenario: Cold start — no cache and upstream down

- GIVEN cache file does not exist AND upstream is unreachable
- WHEN cache layer reads data
- THEN the system MUST raise a cache-miss error (triggering 503 at the API layer)

### Requirement: Cache write

The system MUST write normalized records to JSON cache files after each successful ingestion cycle.

#### Scenario: Write after ingestion

- GIVEN ingestion produced 6 records for SE
- WHEN cache layer persists
- THEN `cache/fuel-prices-eu.json` is atomically overwritten with a JSON array of records
- AND each record includes `cached_at` as an ISO-8601 timestamp

#### Scenario: Partial write protection

- GIVEN disk is full or write permissions are missing
- WHEN cache layer persists
- THEN existing cache file MUST NOT be corrupted — the write SHALL fail without touching the current file

### Requirement: Refresh scheduling

The system MUST refresh fuel-prices.eu data weekly on Friday. SSB data SHALL refresh on its own monthly schedule independent of the EU refresh.

#### Scenario: Weekly Friday refresh triggers EU ingestion

- GIVEN `cached_at` is older than 7 days AND current day is Friday
- WHEN the scheduler evaluates refresh
- THEN EU ingestion is triggered

#### Scenario: Fresh cache skips refresh

- GIVEN `cached_at` is less than 7 days old
- WHEN the scheduler evaluates refresh
- THEN no re-ingestion is triggered for that source

#### Scenario: SSB refresh on its own schedule

- GIVEN SSB data updates monthly and SSB cache is older than 30 days
- WHEN the scheduler evaluates SSB refresh
- THEN SSB ingestion is triggered independently of EU refresh status
