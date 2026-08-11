# Delta for data-ingestion

## ADDED Requirements

### Requirement: Ingest fuel-prices.eu data

The system MUST fetch `https://www.fuel-prices.eu/llms.txt` and extract per-country fuel prices for SE, DK, FI, plus the ECB EUR→SEK reference rate.

#### Scenario: Successful fetch and parse

- GIVEN fuel-prices.eu llms.txt is reachable
- WHEN ingestion runs
- THEN records for SE, DK, FI are produced with `price_eur` populated per fuel type
- AND the ECB EUR→SEK rate is extracted and stored for normalization

#### Scenario: ECB rate missing in llms.txt

- GIVEN llms.txt response lacks the ECB rate section
- WHEN ingestion parses the response
- THEN the system MUST fall back to a configured default rate and log a warning

#### Scenario: fuel-prices.eu unreachable

- GIVEN fuel-prices.eu is down or times out
- WHEN ingestion runs
- THEN the error SHALL be logged and no EU records are emitted for this cycle

### Requirement: Ingest SSB Statbank data

The system MUST fetch `https://data.ssb.no/api/v0/en/table/09654` as JSON-stat and extract Norwegian fuel prices.

#### Scenario: Successful SSB fetch

- GIVEN SSB API is reachable
- WHEN ingestion runs
- THEN NO records are produced with `price_native` in NOK and `price_eur` converted from NOK

#### Scenario: SSB returns an error response

- GIVEN SSB returns HTTP 500 or a JSON-stat error envelope
- WHEN ingestion runs
- THEN the error SHALL be logged and no NO records are emitted for this cycle

#### Scenario: SSB JSON-stat structure changes

- GIVEN SSB response schema differs from expected dimensions
- WHEN ingestion parses the response
- THEN parsing MUST fail with a typed error — never silently emit incomplete records

### Requirement: Normalize to unified schema

All ingested records MUST conform to `{ country, fuel, price_eur, price_native, price_native_currency, price_sek, date, frequency }`.

#### Scenario: EUR→SEK conversion applied

- GIVEN ECB rate = 11.50 SEK/EUR and Diesel price in EUR = 1.45
- WHEN normalization runs
- THEN `price_eur` = 1.45, `price_sek` = 16.68 (rounded to two decimals)
- AND `price_native` = `price_eur` for eurozone countries (SE, FI)
- AND `price_native` = `price_eur × local_rate` for non-euro countries (DK, NO)

#### Scenario: Missing required field after parse

- GIVEN parsed data is missing `price_eur` for a fuel entry
- WHEN normalization runs
- THEN that entry SHALL be dropped and a warning logged
