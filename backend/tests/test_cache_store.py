"""Tests for CacheStore — atomic I/O, read/write, exists, _path, country index files.

Tests migrated from ``test_file_cache.py`` after splitting the coupled test file.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from cache.cache_store import CacheStore
from models.errors import CacheMissError
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


# ── Fresh cache hit ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_read_returns_records_on_fresh_cache_hit(tmp_path: Path):
    """GIVEN a valid cache file WHEN read THEN records are returned.

    This is the primary happy path — spec scenario: Fresh cache hit.
    """
    store = CacheStore(tmp_path)

    records = [
        _make_record(country="SE", fuel="euro_95"),
        _make_record(country="SE", fuel="diesel", price_eur="1.55", price_sek="17.83"),
    ]
    store.write("fuel-prices-eu", records)

    result = store.read("fuel-prices-eu")

    assert len(result) == 2
    assert result[0].country == Country.SE
    assert result[0].fuel == FuelType.EURO_95
    assert result[1].country == Country.SE
    assert result[1].fuel == FuelType.DIESEL
    # All PriceRecord fields must round-trip
    assert result[0].price_eur == Decimal("1.45")
    assert result[0].price_sek == Decimal("16.68")


# ── Cold start ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_read_raises_cache_miss_on_cold_start(tmp_path: Path):
    """GIVEN no cache file WHEN read THEN CacheMissError.

    Spec scenario: Cold start — no cache and upstream down.
    """
    store = CacheStore(tmp_path)

    with pytest.raises(CacheMissError) as exc_info:
        store.read("fuel-prices-eu")

    assert "fuel-prices-eu" in exc_info.value.message


@pytest.mark.unit
def test_read_raises_cache_miss_for_different_source(tmp_path: Path):
    """GIVEN cache for one source WHEN read a different source THEN CacheMissError."""
    store = CacheStore(tmp_path)

    store.write("fuel-prices-eu", [_make_record()])

    with pytest.raises(CacheMissError):
        store.read("ssb-no")


# ── Exists ───────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_exists_returns_true_when_cache_file_present(tmp_path: Path):
    """GIVEN a cache file written for a source WHEN exists THEN True."""
    store = CacheStore(tmp_path)
    store.write("fuel-prices-eu", [_make_record()])
    assert store.exists("fuel-prices-eu") is True


@pytest.mark.unit
def test_exists_returns_false_when_no_cache_file(tmp_path: Path):
    """GIVEN no cache file for a source WHEN exists THEN False."""
    store = CacheStore(tmp_path)
    assert store.exists("non-existent-source") is False


# ── _path ────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_path_appends_json_extension(tmp_path: Path):
    """GIVEN a source name WHEN _path THEN returns cache_dir / <source>.json."""
    store = CacheStore(tmp_path)
    expected = tmp_path / "my-source.json"
    assert store._path("my-source") == expected  # noqa: SLF001


# ── Atomic write ─────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_atomic_write_protects_existing_on_os_replace_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """GIVEN valid cache exists WHEN os.replace fails THEN original is preserved.

    Spec scenario: Partial write protection — existing file must not be corrupted.
    """
    store = CacheStore(tmp_path)

    original = _make_record(
        country="SE", fuel="euro_95", price_eur="1.45", price_sek="16.68"
    )
    store.write("fuel-prices-eu", [original])

    # Patch os.replace to simulate a catastrophic failure during atomic rename
    def _failing_replace(src: str, dst: str) -> None:
        raise OSError("Simulated disk failure during os.replace")

    monkeypatch.setattr(os, "replace", _failing_replace)

    new_record = _make_record(
        country="DK", fuel="diesel", price_eur="1.60", price_sek="18.40"
    )
    with pytest.raises(OSError, match="Simulated disk failure"):
        store.write("fuel-prices-eu", [new_record])

    # Original cache must be intact
    result = store.read("fuel-prices-eu")
    assert len(result) == 1
    assert result[0].country == Country.SE
    assert result[0].fuel == FuelType.EURO_95
    assert result[0].price_eur == Decimal("1.45")


@pytest.mark.unit
def test_atomic_write_creates_parent_directory(tmp_path: Path):
    """GIVEN cache dir does not exist WHEN write THEN directory is created."""
    cache_dir = tmp_path / "nested" / "cache"
    store = CacheStore(cache_dir=cache_dir)

    assert not cache_dir.exists()

    store.write("fuel-prices-eu", [_make_record()])

    assert cache_dir.exists()
    assert (cache_dir / "fuel-prices-eu.json").exists()


# ── Write/read round-trip with multiple records ──────────────────────────────


@pytest.mark.unit
def test_write_then_read_preserves_all_record_fields(tmp_path: Path):
    """Write records covering all four countries and both fuel types, read back."""
    store = CacheStore(tmp_path)

    records = [
        _make_record(
            country="SE", fuel="euro_95",
            price_eur="1.45", price_native="1.45",
            price_native_currency="EUR", price_sek="16.68",
        ),
        _make_record(
            country="SE", fuel="diesel",
            price_eur="1.55", price_native="1.55",
            price_native_currency="EUR", price_sek="17.83",
        ),
        _make_record(
            country="DK", fuel="euro_95",
            price_eur="1.52", price_native="11.32",
            price_native_currency="DKK", price_sek="17.48",
        ),
        _make_record(
            country="FI", fuel="diesel",
            price_eur="1.48", price_native="1.48",
            price_native_currency="EUR", price_sek="17.02",
        ),
        _make_record(
            country="NO", fuel="euro_95",
            price_eur="1.60", price_native="22.50",
            price_native_currency="NOK", price_sek="18.40",
        ),
    ]
    store.write("all-countries", records)

    result = store.read("all-countries")

    assert len(result) == 5
    countries = {r.country for r in result}
    assert countries == {Country.SE, Country.DK, Country.FI, Country.NO}
    # Verify Decimal fields survived the JSON round-trip
    assert result[2].price_native == Decimal("11.32")
    assert result[4].price_native == Decimal("22.50")


# ── Cache file format ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_cache_file_has_expected_json_structure(tmp_path: Path):
    """Written cache file must have cached_at (ISO-8601) and records list."""
    store = CacheStore(tmp_path)

    record = _make_record()
    store.write("fuel-prices-eu", [record])

    raw = json.loads((tmp_path / "fuel-prices-eu.json").read_text())

    assert "cached_at" in raw
    assert "records" in raw
    assert isinstance(raw["records"], list)
    assert len(raw["records"]) == 1
    # cached_at must be parseable as ISO-8601 datetime
    cached_at = datetime.fromisoformat(raw["cached_at"])
    assert isinstance(cached_at, datetime)
    # cached_at should be recent (within last 5 seconds)
    now = datetime.now(UTC)
    diff = now - cached_at.replace(tzinfo=UTC)
    assert diff.total_seconds() < 5


# ── Error handling — corrupt cache ───────────────────────────────────────────


@pytest.mark.unit
def test_read_raises_on_malformed_json(tmp_path: Path):
    """GIVEN a cache file with invalid JSON WHEN read THEN an error is raised."""
    store = CacheStore(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text("not valid json {{{")

    with pytest.raises(Exception):  # json.JSONDecodeError or wrapped AppError
        store.read("fuel-prices-eu")


@pytest.mark.unit
def test_read_raises_on_missing_records_key(tmp_path: Path):
    """GIVEN a cache file missing the 'records' key WHEN read THEN an error is raised."""
    store = CacheStore(tmp_path)
    cache_path = tmp_path / "fuel-prices-eu.json"
    cache_path.write_text(json.dumps({"cached_at": "2026-06-26T00:00:00"}))

    with pytest.raises(Exception):
        store.read("fuel-prices-eu")


# ── Triangulation: boundary cases ────────────────────────────────────────────


@pytest.mark.unit
def test_write_empty_records_list(tmp_path: Path):
    """Writing an empty list of records is valid and preserves structure."""
    store = CacheStore(tmp_path)

    store.write("fuel-prices-eu", [])

    raw = json.loads((tmp_path / "fuel-prices-eu.json").read_text())
    assert raw["records"] == []
    assert "cached_at" in raw


@pytest.mark.unit
def test_multiple_reads_are_idempotent(tmp_path: Path):
    """Reading the same source multiple times returns identical results."""
    store = CacheStore(tmp_path)

    records = [
        _make_record(country="SE", fuel="euro_95"),
        _make_record(country="DK", fuel="diesel"),
    ]
    store.write("fuel-prices-eu", records)

    first = store.read("fuel-prices-eu")
    second = store.read("fuel-prices-eu")

    assert len(first) == len(second) == 2
    for a, b in zip(first, second, strict=True):
        assert a.country == b.country
        assert a.fuel == b.fuel
        assert a.price_eur == b.price_eur
        assert a.price_sek == b.price_sek


@pytest.mark.unit
def test_write_overwrites_existing_cache_for_same_source(tmp_path: Path):
    """Writing to the same source replaces the previous cache entirely."""
    store = CacheStore(tmp_path)

    old = _make_record(country="SE", fuel="euro_95", price_eur="1.00")
    store.write("fuel-prices-eu", [old])

    new = _make_record(country="NO", fuel="diesel", price_eur="2.00")
    store.write("fuel-prices-eu", [new])

    result = store.read("fuel-prices-eu")
    assert len(result) == 1
    assert result[0].country == Country.NO
    assert result[0].fuel == FuelType.DIESEL
    assert result[0].price_eur == Decimal("2.00")


@pytest.mark.unit
def test_read_returns_records_correctly_for_special_source_names(tmp_path: Path):
    """Source names with special chars (dashes, dots) must work."""
    store = CacheStore(tmp_path)

    records = [_make_record(country="FI", fuel="euro_95")]
    store.write("fuel-prices-eu-v2", records)
    store.write("ssb.no.09654", records)

    assert len(store.read("fuel-prices-eu-v2")) == 1
    assert len(store.read("ssb.no.09654")) == 1


# ── Country index files ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_write_creates_country_index_files(tmp_path: Path):
    """GIVEN records for multiple countries WHEN write THEN index files are created."""
    store = CacheStore(tmp_path)

    records = [
        _make_record(country="SE", fuel="euro_95"),
        _make_record(country="DK", fuel="diesel"),
        _make_record(country="FI", fuel="euro_95"),
        _make_record(country="SE", fuel="diesel"),
    ]
    store.write("fuel-prices-eu", records)

    idx_se = tmp_path / "fuel-prices-eu_idx_SE.json"
    idx_dk = tmp_path / "fuel-prices-eu_idx_DK.json"
    idx_fi = tmp_path / "fuel-prices-eu_idx_FI.json"

    assert idx_se.exists()
    assert idx_dk.exists()
    assert idx_fi.exists()

    se_records = store.read("fuel-prices-eu_idx_SE")
    assert len(se_records) == 2
    assert se_records[0].country == Country.SE
    assert se_records[1].country == Country.SE

    dk_records = store.read("fuel-prices-eu_idx_DK")
    assert len(dk_records) == 1
    assert dk_records[0].country == Country.DK


@pytest.mark.unit
def test_country_index_file_has_same_format_as_main_cache(tmp_path: Path):
    """Index files have cached_at and records keys, same as the main cache file."""
    store = CacheStore(tmp_path)

    store.write("fuel-prices-eu", [_make_record(country="SE")])

    raw = json.loads((tmp_path / "fuel-prices-eu_idx_SE.json").read_text())
    assert "cached_at" in raw
    assert "records" in raw
    assert len(raw["records"]) == 1
