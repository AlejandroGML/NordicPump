# prices-api Specification

## Purpose

REST endpoint serving normalized Nordic fuel prices indexed by country. Returns both SEK-equivalent and native currency (DKK/NOK) prices per fuel type.

## Requirements

### Requirement: Price lookup by country

The system MUST serve normalized fuel prices at `GET /api/v1/prices/{country}` for valid country codes: `se`, `dk`, `fi`, `no`.

#### Scenario: Swedish prices returned

- GIVEN cache has fresh SE data
- WHEN `GET /api/v1/prices/se`
- THEN response is `200 OK` with JSON body containing `country: "SE"` and a `prices` array
- AND each price entry includes `fuel`, `price_sek`, `price_native`, `price_native_currency`, `date`, and `frequency`

#### Scenario: Norwegian prices with native NOK

- GIVEN cache has fresh NO data from SSB
- WHEN `GET /api/v1/prices/no`
- THEN `price_native` contains NOK values and `price_sek` contains SEK-converted values via EUR→SEK rate
- AND `price_native_currency` is `"NOK"`

#### Scenario: Unsupported country code

- GIVEN a request for an unknown country
- WHEN `GET /api/v1/prices/xx`
- THEN `404 Not Found` with error body `{ "error": { "code": "UNSUPPORTED_COUNTRY", "message": "Country 'XX' is not supported. Valid: se, dk, fi, no" } }`

#### Scenario: Cold start — no cache and upstream down

- GIVEN cache file does not exist AND upstream ingestion fails
- WHEN `GET /api/v1/prices/se`
- THEN `503 Service Unavailable` with `Retry-After: 300` header
- AND error body `{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Price data not yet available. Try again later." } }`

### Requirement: Health check

The system MUST provide `GET /health`.

#### Scenario: Service healthy

- GIVEN the service is running
- WHEN `GET /health`
- THEN `200 OK` with `{ "status": "ok", "timestamp": "<ISO-8601>" }`
