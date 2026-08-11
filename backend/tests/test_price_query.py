"""Tests for services/price_query.py — cache-first price resolution.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN → TRIANGULATE → REFACTOR).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import respx

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from models.errors import CacheMissError
from models.price import Country, FuelType, PriceRecord, PriceResponse

# ═══════════════════════════════════════════════════════════════════════════════
# RED: Importing code that does NOT exist yet
# ═══════════════════════════════════════════════════════════════════════════════
from services.ingestion_pipeline import IngestionPipeline  # noqa: E402 — RED
from services.price_query import PriceQueryService  # noqa: E402 — does NOT exist yet (RED)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_record(
    country: str = "SE",
    fuel: str = "euro_95",
    price_eur: str = "1.45",
    price_native: str = "1.45",
    price_native_currency: str = "EUR",
    price_sek: str = "16.68",
    record_date: date | None = None,
    frequency: str = "weekly",
) -> PriceRecord:
    """Factory for a valid PriceRecord with sensible defaults."""
    return PriceRecord(
        country=Country(country),
        fuel=FuelType(fuel),
        price_eur=Decimal(price_eur),
        price_native=Decimal(price_native),
        price_native_currency=price_native_currency,
        price_sek=Decimal(price_sek),
        date=record_date or date(2026, 6, 26),
        frequency=frequency,
    )


def _settings(cache_dir: Path) -> Settings:
    """Create Settings with a specific cache_dir for testing."""
    return Settings(
        cache_dir=cache_dir,
        _env_file=None,  # type: ignore[call-arg]
    )


# ── EU llms.txt fixture ─────────────────────────────────────────────────────

EU_LLMS_TXT = """## Fuel price comparison in the EU - 2026-06-25
Last updated: 2026-06-25

CC   Country               Euro 95 (€)  Diesel (€)
---  --------------------  -----------  ----------
 SE  Sweden                 € 1.450      € 1.550
 DK  Denmark                € 1.520      € 1.480
 FI  Finland                € 1.490      € 1.490
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.a — Cache HIT: fresh cache returns records with X-Cache: HIT
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_returns_records_on_fresh_cache_hit(tmp_path: Path):
    """GIVEN fresh EU cache WHEN resolve(Country.SE) THEN PriceResponse with X-Cache: HIT.

    Spec: prices-api → Swedish prices returned.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    # Pre-write fresh EU cache with SE records
    records = [
        _make_record(country="SE", fuel="euro_95", price_eur="1.45", price_sek="16.68"),
        _make_record(country="SE", fuel="diesel", price_eur="1.55", price_sek="17.83"),
    ]
    store.write("fuel-prices-eu", records)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    async with httpx.AsyncClient() as client:
        result, status = await service.resolve(Country.SE, client)

    assert status == "HIT"
    assert isinstance(result, PriceResponse)
    assert result.country == Country.SE
    assert len(result.prices) == 2
    assert result.prices[0].fuel == FuelType.EURO_95
    assert result.prices[0].price_sek == Decimal("16.68")
    assert result.prices[1].fuel == FuelType.DIESEL
    assert result.prices[1].price_sek == Decimal("17.83")


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.b — Cache STALE + upstream OK → REFRESHED
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_refreshes_on_stale_cache_when_upstream_ok(tmp_path: Path):
    """GIVEN stale cache WHEN upstream fetch succeeds THEN X-Cache: REFRESHED.

    Spec: price-cache → Stale cache fallback should trigger refresh.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    # Manually write stale cache (old cached_at)
    old_record = _make_record(
        country="SE", fuel="euro_95", price_eur="1.40", price_sek="16.10",
        record_date=date(2026, 6, 1),
    )
    old_data = {
        "cached_at": "2026-05-01T00:00:00",
        "records": [old_record.model_dump(mode="json")],
    }
    (tmp_path / "fuel-prices-eu.json").write_text(
        __import__("json").dumps(old_data, default=str)
    )

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    # Mock upstream to respond successfully (both EU and SSB)
    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=EU_LLMS_TXT)
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(
            200, json=_SSB_RESPONSE,
        )
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200,
            text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            result, status = await service.resolve(Country.SE, client)

    assert status == "REFRESHED"
    # Merge keeps history: 1 old snapshot (2026-06-01) + 2 new records.
    assert len(result.prices) == 3
    # The NEW prices are first (date-descending sort), not the old ones
    assert result.prices[0].price_sek != Decimal("16.10")
    # Historical snapshot is preserved for the price-history chart
    assert result.prices[-1].price_sek == Decimal("16.10")


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.c — Cache STALE + upstream FAIL → STALE fallback
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_serves_stale_on_upstream_failure(tmp_path: Path):
    """GIVEN stale cache WHEN upstream is unreachable THEN X-Cache: STALE.

    Spec: price-cache → Stale cache fallback on upstream failure.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    # Pre-write stale cache (outside 7-day window)
    record = _make_record(country="DK", fuel="diesel", price_eur="1.48", price_sek="17.02")
    old_data = {
        "cached_at": "2026-01-01T00:00:00",
        "records": [record.model_dump(mode="json")],
    }
    (tmp_path / "fuel-prices-eu.json").write_text(
        __import__("json").dumps(old_data, default=str)
    )

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    # Both upstreams and ECB fail (so refresh fails entirely)
    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with httpx.AsyncClient() as client:
            result, status = await service.resolve(Country.DK, client)

    assert status == "STALE"
    assert len(result.prices) == 1
    assert result.prices[0].country == Country.DK
    assert result.prices[0].fuel == FuelType.DIESEL
    assert result.prices[0].price_eur == Decimal("1.48")


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.d — Cache MISS + upstream OK → REFRESHED
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_refreshes_on_cache_miss_when_upstream_ok(tmp_path: Path):
    """GIVEN no cache file WHEN upstream fetch succeeds THEN X-Cache: REFRESHED.

    Spec: Cold start scenario resolved by successful ingestion.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=EU_LLMS_TXT)
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(
            200, json=_SSB_RESPONSE,
        )
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            result, status = await service.resolve(Country.FI, client)

    assert status == "REFRESHED"
    assert result.country == Country.FI
    assert len(result.prices) == 2  # euro_95 + diesel for FI
    # All records must be for FI only
    for price in result.prices:
        assert price.country == Country.FI


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.e — Cache MISS + upstream FAIL → CacheMissError (503 at route level)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_raises_cache_miss_on_cold_start_upstream_down(tmp_path: Path):
    """GIVEN no cache AND upstream unreachable WHEN resolve THEN CacheMissError.

    Spec: prices-api → Cold start — no cache and upstream down → 503.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    with respx.mock as mock:
        # Everything fails — cold start, no fallback
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with httpx.AsyncClient() as client:
            with pytest.raises(CacheMissError, match="not yet available"):
                await service.resolve(Country.SE, client)


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.f — Country filter: only target country records returned
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_filters_by_country(tmp_path: Path):
    """GIVEN cache with SE + DK + FI records WHEN resolve(Country.SE) THEN only SE.

    Triangulation: different country, different filter result.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    # Pre-write fresh cache with all 3 EU countries
    records = [
        _make_record(country="SE", fuel="euro_95", price_eur="1.45", price_sek="16.68"),
        _make_record(country="SE", fuel="diesel", price_eur="1.55", price_sek="17.83"),
        _make_record(country="DK", fuel="euro_95", price_eur="1.52", price_sek="17.48"),
        _make_record(country="DK", fuel="diesel", price_eur="1.48", price_sek="17.02"),
        _make_record(country="FI", fuel="euro_95", price_eur="1.49", price_sek="17.14"),
        _make_record(country="FI", fuel="diesel", price_eur="1.49", price_sek="17.14"),
    ]
    store.write("fuel-prices-eu", records)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    async with httpx.AsyncClient() as client:
        result, status = await service.resolve(Country.SE, client)

    assert status == "HIT"
    assert len(result.prices) == 2
    for price in result.prices:
        assert price.country == Country.SE


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.g — Norway: resolve with SSB data
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_norway_returns_nok_prices(tmp_path: Path):
    """GIVEN fresh SSB cache WHEN resolve(Country.NO) THEN NOK native prices.

    Spec: prices-api → Norwegian prices with native NOK.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    # Pre-write fresh NO cache
    records = [
        _make_record(
            country="NO", fuel="euro_95",
            price_eur=Decimal("16.66"), price_native=Decimal("200.00"),
            price_native_currency="NOK", price_sek=Decimal("191.59"),
            frequency="monthly",
        ),
        _make_record(
            country="NO", fuel="diesel",
            price_eur=Decimal("15.83"), price_native=Decimal("190.00"),
            price_native_currency="NOK", price_sek=Decimal("182.05"),
            frequency="monthly",
        ),
    ]
    store.write("ssb-no", records)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    async with httpx.AsyncClient() as client:
        result, status = await service.resolve(Country.NO, client)

    assert status == "HIT"
    assert result.country == Country.NO
    assert len(result.prices) == 2
    assert result.prices[0].price_native_currency == "NOK"
    assert result.prices[1].price_native_currency == "NOK"


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.h — _ingest_all: fetches all sources, normalizes, writes cache
# ═══════════════════════════════════════════════════════════════════════════════


# ECB XML fixture for tests
_ECB_XML = """<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<gesmes:subject>Reference rates</gesmes:subject>
<gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
<Cube>
  <Cube time="2026-06-25">
    <Cube currency="USD" rate="1.1000"/>
    <Cube currency="SEK" rate="11.5000"/>
    <Cube currency="DKK" rate="7.4500"/>
    <Cube currency="NOK" rate="12.0000"/>
  </Cube>
</Cube>
</gesmes:Envelope>"""


@pytest.mark.asyncio
async def test_ingest_all_fetches_and_normalizes_and_writes(tmp_path: Path):
    """GIVEN valid upstream responses WHEN _ingest_all THEN cache files written for both sources."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=EU_LLMS_TXT)
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(
            200, json=_SSB_RESPONSE,
        )
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            await pipeline._ingest_all(client)

    # Verify cache files were written
    assert (tmp_path / "fuel-prices-eu.json").exists()
    assert (tmp_path / "ssb-no.json").exists()

    # Verify EU cache content
    eu_records = store.read("fuel-prices-eu")
    assert len(eu_records) == 6  # 3 countries × 2 fuels
    countries = {r.country for r in eu_records}
    assert countries == {Country.SE, Country.DK, Country.FI}

    # Verify NO cache content
    no_records = store.read("ssb-no")
    assert len(no_records) > 0
    for r in no_records:
        assert r.country == Country.NO
        assert r.price_native_currency == "NOK"


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1.i — Partial failure: EU succeeds, SSB fails → EU resolution still works
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_resolve_ok_when_ssb_fails_but_eu_succeeds(tmp_path: Path):
    """GIVEN SSB is down WHEN resolving SE THEN EU data still returned (REFRESHED).

    Triangulation: proves _ingest_all's independent-source design.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=EU_LLMS_TXT)
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            result, status = await service.resolve(Country.SE, client)

    assert status == "REFRESHED"
    assert result.country == Country.SE
    assert len(result.prices) == 2


# Minimal SSB JSON-stat2 response for testing (3-dimension format).
# Dimensions: PetroleumProd (031/035) × ContentsCode (Priser) × Tid (months)
_SSB_RESPONSE = {
    "version": "2.0",
    "class": "dataset",
    "label": "09654: Fuel prices, by contents, month and region",
    "source": "Statistics Norway",
    "updated": "2026-06-25T08:00:00Z",
    "dimension": {
        "PetroleumProd": {
            "label": "petroleum product",
            "category": {
                "index": {"031": 0, "035": 1},
                "label": {"031": "Motor gasoline, leadfree 95 octan", "035": "Dutiable diesel"},
            },
        },
        "ContentsCode": {
            "label": "contents",
            "category": {
                "index": {"Priser": 0},
                "label": {"Priser": "Priser"},
            },
        },
        "Tid": {
            "label": "month",
            "category": {
                "index": {"2026M05": 0, "2026M04": 1},
                "label": {"2026M05": "2026M05", "2026M04": "2026M04"},
            },
        },
    },
    "size": [2, 1, 2],
    "value": [20.50, 20.15, 21.30, 20.95],
}
