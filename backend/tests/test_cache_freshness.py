"""Tests for CacheFreshness — is_fresh, get_cached_at, time window logic.

Tests migrated from ``test_file_cache.py`` after splitting the coupled test file.
CacheStore is imported for test data setup, not as the subject under test.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from models.price import Country, FuelType, PriceRecord

# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_record(
    country: str = "SE",
    fuel: str = "euro_95",
    price_eur: str = "1.45",
    price_native: str = "1.45",
    price_native_currency: str = "EUR",
    price_sek: str = "16.68",
    record_date: date | None = None,
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
        frequency="weekly",
    )


# ── is_fresh — stale / expired ──────────────────────────────────────────────


@pytest.mark.unit
def test_is_fresh_returns_false_when_cache_expired(tmp_path: Path):
    """GIVEN cache older than window WHEN is_fresh THEN False.

    Spec scenario: Stale cache fallback.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)

    record = _make_record()
    store.write("fuel-prices-eu", [record])

    # Manually rewrite the cache file to have an old cached_at timestamp
    cache_path = tmp_path / "fuel-prices-eu.json"
    old_data = {
        "cached_at": "2026-06-01T00:00:00",
        "records": [record.model_dump(mode="json")],
    }
    cache_path.write_text(json.dumps(old_data, default=str))

    window = timedelta(days=7)

    assert freshness.is_fresh("fuel-prices-eu", window) is False


@pytest.mark.unit
def test_is_fresh_returns_true_within_window(tmp_path: Path):
    """GIVEN recently-written cache WHEN is_fresh THEN True."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)

    record = _make_record()
    store.write("fuel-prices-eu", [record])

    window = timedelta(days=7)

    assert freshness.is_fresh("fuel-prices-eu", window) is True


@pytest.mark.unit
def test_is_fresh_returns_false_for_missing_cache(tmp_path: Path):
    """GIVEN no cache file WHEN is_fresh THEN False."""
    freshness = CacheFreshness(tmp_path)

    assert freshness.is_fresh("nonexistent", timedelta(days=7)) is False


# ── is_fresh — boundary cases ────────────────────────────────────────────────


@pytest.mark.unit
def test_is_fresh_exactly_at_window_boundary_is_not_fresh(tmp_path: Path):
    """GIVEN cache exactly at the window boundary WHEN is_fresh THEN False.

    The freshness check uses strict less-than (<), so exactly-at-boundary
    should return False.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)

    record = _make_record()
    store.write("fuel-prices-eu", [record])

    window = timedelta(seconds=0)  # any age >= 0 is not fresh

    # Cache was just written, so it should be NOT fresh with a zero window
    assert freshness.is_fresh("fuel-prices-eu", window) is False


@pytest.mark.unit
def test_is_fresh_returns_true_when_one_second_inside_window(tmp_path: Path):
    """GIVEN cache written 1s ago WHEN window is 2s THEN fresh is True."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)

    record = _make_record()
    store.write("fuel-prices-eu", [record])

    window = timedelta(seconds=365 * 24 * 3600)  # 1 year — huge window

    assert freshness.is_fresh("fuel-prices-eu", window) is True


# ── is_fresh — corrupt / edge cases ──────────────────────────────────────────


@pytest.mark.unit
def test_is_fresh_on_corrupt_cache_returns_false(tmp_path: Path):
    """GIVEN cache file with corrupt JSON WHEN is_fresh THEN False (safe default)."""
    freshness = CacheFreshness(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text("garbage {{{ not json")

    assert freshness.is_fresh("fuel-prices-eu", timedelta(days=365)) is False


@pytest.mark.unit
def test_is_fresh_on_cache_missing_cached_at_key_returns_false(tmp_path: Path):
    """GIVEN cache file missing cached_at WHEN is_fresh THEN False (safe default)."""
    freshness = CacheFreshness(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text(json.dumps({"records": []}))

    assert freshness.is_fresh("fuel-prices-eu", timedelta(days=365)) is False


# ── get_cached_at ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_cached_at_returns_datetime_when_cache_exists(tmp_path: Path):
    """GIVEN a valid cache file WHEN get_cached_at THEN returns parsed datetime."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)

    store.write("fuel-prices-eu", [_make_record()])

    result = freshness.get_cached_at("fuel-prices-eu")
    assert result is not None
    assert isinstance(result, datetime)
    # Should be recent
    diff = datetime.now(UTC) - result.replace(tzinfo=UTC)
    assert diff.total_seconds() < 5


@pytest.mark.unit
def test_get_cached_at_returns_none_when_cache_missing(tmp_path: Path):
    """GIVEN no cache file WHEN get_cached_at THEN returns None."""
    freshness = CacheFreshness(tmp_path)
    assert freshness.get_cached_at("nonexistent") is None


@pytest.mark.unit
def test_get_cached_at_returns_none_on_corrupt_cache(tmp_path: Path):
    """GIVEN corrupt cache file WHEN get_cached_at THEN returns None."""
    freshness = CacheFreshness(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text("not json")

    assert freshness.get_cached_at("fuel-prices-eu") is None


@pytest.mark.unit
def test_get_cached_at_returns_none_when_cached_at_missing(tmp_path: Path):
    """GIVEN cache file missing cached_at key WHEN get_cached_at THEN returns None."""
    freshness = CacheFreshness(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text(json.dumps({"records": []}))

    assert freshness.get_cached_at("fuel-prices-eu") is None
