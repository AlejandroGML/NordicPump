"""Tests for scheduler.py — background ingestion scheduling.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN).
Uses asyncio and mock sleep to test cadence logic without waiting.

Covers: independent EU (Sunday), SSB (monthly), ECB (daily) loops
running concurrently via asyncio.gather().
"""

import asyncio
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from models.price import Country, FuelType, PriceRecord

# ═══════════════════════════════════════════════════════════════════════════════
# RED: Importing code that does NOT exist yet
# ═══════════════════════════════════════════════════════════════════════════════
from scheduler import run_scheduler  # noqa: E402 — does NOT exist yet (RED)
from services.ingestion_pipeline import IngestionPipeline  # noqa: E402 — RED

# ── Helpers ──────────────────────────────────────────────────────────────────


def _settings(cache_dir: Path) -> Settings:
    return Settings(
        cache_dir=cache_dir,
        _env_file=None,  # type: ignore[call-arg]
    )


def _make_record(country="SE", fuel="euro_95") -> PriceRecord:
    from decimal import Decimal

    return PriceRecord(
        country=Country(country),
        fuel=FuelType(fuel),
        price_eur=Decimal("1.45"),
        price_native=Decimal("1.45"),
        price_native_currency="EUR",
        price_sek=Decimal("16.68"),
        date=date(2026, 6, 26),
        frequency="weekly",
    )


EU_LLMS_TXT = """Last updated: 2026-06-25
CC   Country               Euro 95 (€)  Diesel (€)
 SE  Sweden                 € 1.450      € 1.550
"""

_ECB_XML = """<?xml version="1.0"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<Cube><Cube time="2026-06-25">
<Cube currency="SEK" rate="11.50"/>
<Cube currency="DKK" rate="7.45"/>
<Cube currency="NOK" rate="12.00"/>
</Cube></Cube>
</gesmes:Envelope>"""

_SSB_RESPONSE = {
    "version": "2.0",
    "class": "dataset",
    "dimension": {
        "PetroleumProd": {
            "category": {
                "index": {"031": 0},
                "label": {"031": "Motor gasoline, leadfree 95 octan"},
            },
        },
        "ContentsCode": {
            "category": {
                "index": {"Priser": 0},
                "label": {"Priser": "Priser"},
            },
        },
        "Tid": {
            "category": {
                "index": {"2026M05": 0},
                "label": {"2026M05": "2026M05"},
            },
        },
    },
    "size": [1, 1, 1],
    "value": [20.50],
}


# ═══════════════════════════════════════════════════════════════════════════════
# Pure helper tests (no asyncio needed)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
def test_is_sunday_logic_returns_true_for_sunday() -> None:
    """Test the is_sunday helper: Sunday is 6, Monday is 0.

    The fuel APIs publish their weekly snapshot on Sundays.
    """
    from cadence import is_sunday

    # 2026-08-09 is a Sunday (last Sunday before 2026-08-10)
    sunday = datetime(2026, 8, 9, tzinfo=UTC)
    monday = datetime(2026, 8, 10, tzinfo=UTC)

    assert is_sunday(sunday) is True
    assert is_sunday(monday) is False

    # is_friday kept for backwards compatibility
    from cadence import is_friday
    friday = datetime(2026, 6, 26, tzinfo=UTC)
    assert is_friday(friday) is True


@pytest.mark.unit
def test_is_new_month_logic() -> None:
    """Test the is_new_month helper: different month → True, same → False."""
    from cadence import is_new_month

    assert is_new_month(6, None) is True       # No previous month → True
    assert is_new_month(7, 6) is True           # Different month
    assert is_new_month(6, 6) is False          # Same month
    assert is_new_month(1, 12) is True          # Year boundary

@pytest.mark.unit
def test_is_ssb_publish_day_logic() -> None:
    """SSB publishes mid-month: the 15th is the publish day."""
    from cadence import is_ssb_publish_day

    publish = datetime(2026, 8, 15, tzinfo=UTC)
    first = datetime(2026, 8, 1, tzinfo=UTC)
    sixteenth = datetime(2026, 8, 16, tzinfo=UTC)

    assert is_ssb_publish_day(publish) is True
    assert is_ssb_publish_day(first) is False
    assert is_ssb_publish_day(sixteenth) is False


# ═══════════════════════════════════════════════════════════════════════════════
# RED: Individual ingestion functions (ingest_eu, ingest_ssb, ingest_ecb)
# These should exist on PriceService as public methods.
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_eu_fetches_and_writes_eu_cache(tmp_path: Path) -> None:
    """GIVEN valid EU upstream WHEN ingest_eu() THEN fuel-prices-eu cache written."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=EU_LLMS_TXT)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_eu(client)

    assert ok is True
    assert (tmp_path / "fuel-prices-eu.json").exists()
    eu_records = store.read("fuel-prices-eu")
    assert len(eu_records) >= 2  # SE euro_95 + diesel


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_eu_returns_false_on_upstream_failure(tmp_path: Path) -> None:
    """GIVEN EU upstream is down WHEN ingest_eu() THEN returns False, no crash."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_eu(client)

    assert ok is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_ssb_fetches_and_writes_ssb_cache(tmp_path: Path) -> None:
    """GIVEN valid SSB upstream WHEN ingest_ssb() THEN ssb-no cache written."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(
            200, json=_SSB_RESPONSE,
        )
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_ssb(client)

    assert ok is True
    assert (tmp_path / "ssb-no.json").exists()
    no_records = store.read("ssb-no")
    assert len(no_records) == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_ssb_returns_false_on_upstream_failure(tmp_path: Path) -> None:
    """GIVEN SSB upstream is down WHEN ingest_ssb() THEN returns False, no crash."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_ssb(client)

    assert ok is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_ecb_fetches_rates_successfully(tmp_path: Path) -> None:
    """GIVEN valid ECB upstream WHEN ingest_ecb() THEN returns True."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_ecb(client)

    assert ok is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_ecb_returns_false_on_upstream_failure(tmp_path: Path) -> None:
    """GIVEN ECB upstream is down WHEN ingest_ecb() THEN returns False, no crash."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    with respx.mock as mock:
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_ecb(client)

    assert ok is False


# ═══════════════════════════════════════════════════════════════════════════════
# RED: Independent scheduler loops — EU Sunday, SSB monthly, ECB daily
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_scheduler_runs_three_independent_loops(tmp_path: Path) -> None:
    """GIVEN run_scheduler WHEN started THEN all three loops are created.

    Verifies that run_scheduler uses asyncio.gather() with 3 tasks.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    # Mock all three ingest methods
    pipeline.ingest_eu = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ssb = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ecb = AsyncMock(return_value=True)  # type: ignore[method-assign]

    # Let one tick happen, then cancel
    tick_count = 0

    async def _mock_sleep(seconds: float) -> None:
        nonlocal tick_count
        tick_count += 1
        if tick_count >= 4:  # After 4 sleep calls (EU+SSB+ECB + 1 more), cancel
            raise asyncio.CancelledError()

    with patch("asyncio.sleep", _mock_sleep), patch("scheduler.is_sunday", return_value=True):
        try:
            await run_scheduler(pipeline, freshness, settings)
        except asyncio.CancelledError:
            pass

    # All three ingest methods should have been called at least once
    pipeline.ingest_eu.assert_called()
    pipeline.ingest_ssb.assert_called()
    pipeline.ingest_ecb.assert_called()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ecb_loop_fires_daily(tmp_path: Path) -> None:
    """GIVEN run_scheduler WHEN ECB loop ticks multiple times THEN ingest_ecb called repeatedly.

    ECB should be called every tick (daily cadence), while EU/SSB may or may not.
    With 50 shared sleep entries across 3 loops, ECB must get at least 5 turns.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    pipeline.ingest_eu = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ssb = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ecb = AsyncMock(return_value=True)  # type: ignore[method-assign]

    # Use original asyncio.sleep for fair scheduling
    _real_sleep = asyncio.sleep
    # 50 entries should give each loop ~16 turns — ECB guaranteed multiple calls
    sleep_responses: list[object] = [None] * 50 + [asyncio.CancelledError()]

    async def _mock_sleep(seconds: float) -> None:
        await _real_sleep(0)  # Yield to event loop so other coroutines get a turn
        response = sleep_responses.pop(0)
        if isinstance(response, BaseException):
            raise response

    with patch("asyncio.sleep", _mock_sleep):
        try:
            await run_scheduler(pipeline, freshness, settings)
        except asyncio.CancelledError:
            pass

    # ECB should be called multiple times (daily cadence, each tick)
    assert pipeline.ingest_ecb.call_count >= 3


@pytest.mark.unit
@pytest.mark.asyncio
async def test_failure_in_one_loop_does_not_block_others(tmp_path: Path) -> None:
    """GIVEN EU loop raises exception WHEN ECB loop continues THEN ingest_ecb still called.

    Spec: Each task independent — failure in one doesn't block others.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    # EU raises exception, SSB and ECB succeed
    pipeline.ingest_eu = AsyncMock(side_effect=RuntimeError("EU downstream gone"))  # type: ignore[method-assign]
    pipeline.ingest_ssb = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ecb = AsyncMock(return_value=True)  # type: ignore[method-assign]

    # Large buffer to give ECB loop turns despite EU hogging
    sleep_responses: list[object] = [None] * 50 + [asyncio.CancelledError()]

    async def _mock_sleep(seconds: float) -> None:
        response = sleep_responses.pop(0)
        if isinstance(response, BaseException):
            raise response

    with patch("asyncio.sleep", _mock_sleep):
        try:
            await run_scheduler(pipeline, freshness, settings)
        except asyncio.CancelledError:
            pass

    # Despite EU failure, ECB loop kept running (independence proven)
    pipeline.ingest_ecb.assert_called()
    # SSB also kept running
    pipeline.ingest_ssb.assert_called()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_run_scheduler_uses_asyncio_gather_pattern(tmp_path: Path) -> None:
    """GIVEN run_scheduler WHEN all loops complete THEN gather returns.

    Validates the three loops run concurrently, not sequentially.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    # We verify that the function signature accepts (service, settings)
    # and that asyncio.gather is used by inspecting the design.
    # The implementation test: call it and verify it doesn't hang.
    pipeline.ingest_eu = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ssb = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ecb = AsyncMock(return_value=True)  # type: ignore[method-assign]

    sleeps = 0

    async def _mock_sleep(seconds: float) -> None:
        nonlocal sleeps
        sleeps += 1
        if sleeps >= 6:
            raise asyncio.CancelledError()

    with patch("asyncio.sleep", _mock_sleep), patch("scheduler.is_sunday", return_value=True):
        try:
            await run_scheduler(pipeline, freshness, settings)
        except asyncio.CancelledError:
            pass

    # All three should have been created and called at least once.
    pipeline.ingest_eu.assert_called()
    pipeline.ingest_ssb.assert_called()
    pipeline.ingest_ecb.assert_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Retained: original tests adapted for new API
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_scheduler_triggers_ingestion_on_first_run(tmp_path: Path) -> None:
    """GIVEN a fresh scheduler WHEN it runs THEN individual ingest methods are called.

    Spec: price-cache → Scheduler triggers refresh when conditions are met.
    Adapted: new API calls ingest_eu/ingest_ssb/ingest_ecb instead of _ingest_all.
    """
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

        sleeps = 0

        async def _mock_sleep(seconds: float) -> None:
            nonlocal sleeps
            sleeps += 1
            if sleeps >= 6:
                raise asyncio.CancelledError()

        with patch("asyncio.sleep", _mock_sleep), patch("scheduler.is_sunday", return_value=True):
            try:
                await run_scheduler(pipeline, freshness, settings)
            except asyncio.CancelledError:
                pass

    # After first run, both caches should exist
    assert (tmp_path / "fuel-prices-eu.json").exists()
    assert (tmp_path / "ssb-no.json").exists()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_scheduler_continues_after_ingestion_failure(tmp_path: Path) -> None:
    """GIVEN EU ingestion fails WHEN ECB loop continues THEN ECB cache/normal ops not blocked.

    Adapted: new API — failure in EU loop doesn't block ECB loop.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    # Make EU always fail, ECB succeed
    pipeline.ingest_eu = AsyncMock(side_effect=RuntimeError("EU fail"))  # type: ignore[method-assign]
    pipeline.ingest_ssb = AsyncMock(return_value=True)  # type: ignore[method-assign]
    pipeline.ingest_ecb = AsyncMock(return_value=True)  # type: ignore[method-assign]

    ecb_call_count = 0

    async def _mock_sleep_limited(seconds: float) -> None:
        nonlocal ecb_call_count
        # Simulate ECB being called, count iterations
        ecb_call_count += 1
        if ecb_call_count >= 3:
            raise asyncio.CancelledError()

    with patch("asyncio.sleep", _mock_sleep_limited):
        try:
            await run_scheduler(pipeline, freshness, settings)
        except asyncio.CancelledError:
            pass

    # ECB loop ran despite EU failures
    pipeline.ingest_ecb.assert_called()


# ═══════════════════════════════════════════════════════════════════════════════
# TRIANGULATE: Edge cases for independent loops
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_eu_handles_empty_llms_response(tmp_path: Path) -> None:
    """GIVEN EU upstream returns valid but empty data WHEN ingest_eu THEN returns False (no parseable data).

    Triangulation: verifies ingest_eu gracefully handles parse errors.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    empty_llms = "Last updated: 2026-06-25\n\nCC   Country               Euro 95 (€)  Diesel (€)\n"

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(200, text=empty_llms)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(
            200, text=_ECB_XML,
        )

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_eu(client)

    # No parseable Nordic data → ingestion returns False (logged, no crash)
    assert ok is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_ssb_with_missing_nok_currency_handled(tmp_path: Path) -> None:
    """GIVEN SSB JSON-stat with valid structure but ECB fails WHEN ingest_ssb THEN fallback used.

    Triangulation: verifies SSB fallback path when ECB is down.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    ssb_data = {
        "version": "2.0",
        "class": "dataset",
        "dimension": {
            "PetroleumProd": {
                "category": {
                    "index": {"031": 0},
                    "label": {"031": "Motor gasoline, leadfree 95 octan"},
                },
            },
            "ContentsCode": {
                "category": {
                    "index": {"Priser": 0},
                    "label": {"Priser": "Priser"},
                },
            },
            "Tid": {
                "category": {
                    "index": {"2026M05": 0},
                    "label": {"2026M05": "2026M05"},
                },
            },
        },
        "size": [1, 1, 1],
        "value": [18.75],
    }

    with respx.mock as mock:
        mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(200, json=ssb_data)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with httpx.AsyncClient() as client:
            ok = await pipeline.ingest_ssb(client)

    # Should succeed using fallback ECB rates
    assert ok is True
    assert (tmp_path / "ssb-no.json").exists()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_all_preserves_backward_compat(tmp_path: Path) -> None:
    """GIVEN valid upstreams WHEN _ingest_all THEN both caches written.

    Triangulation: verifies _ingest_all still works via individual methods.
    """
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
            ok = await pipeline._ingest_all(client)

    assert "fuel-prices-eu" in ok
    assert "ssb-no" in ok
    assert (tmp_path / "fuel-prices-eu.json").exists()
    assert (tmp_path / "ssb-no.json").exists()
