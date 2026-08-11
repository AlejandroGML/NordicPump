"""Tests for ingestion/normalizer.py — unify raw records into PriceRecord list.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN → TRIANGULATE → REFACTOR).

Key spec scenario: EUR→SEK conversion — 1.45 × 11.50 = 16.68 (Decimal, ROUND_HALF_UP).
"""

from datetime import date
from decimal import Decimal

import pytest

from ingestion.normalizer import normalize  # noqa: E402 — RED
from models.price import Country, FuelType

# ── Helpers ────────────────────────────────────────────────────────────────


_DEFAULT_DATE = date(2026, 6, 22)


def _raw(
    country: str = "SE",
    fuel: str = "euro_95",
    price_eur: str = "1.535",
    *,
    record_date: date | None = _DEFAULT_DATE,
) -> dict[str, object]:
    """Factory for a raw record dict from fuel_prices_eu parser.

    Pass ``record_date=None`` explicitly to simulate a missing-date record.
    """
    return {
        "country": country,
        "fuel": fuel,
        "price_eur": Decimal(price_eur),
        "date": record_date,
    }


# ── Sweden (EUR native) ───────────────────────────────────────────────────


@pytest.mark.unit
def test_normalizer_produces_price_record_for_sweden_euro95():
    """GIVEN raw SE euro_95 record WHEN normalized THEN correct PriceRecord."""
    records = normalize(
        [_raw("SE", "euro_95", "1.535")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    assert len(records) == 1
    r = records[0]
    assert r.country == Country.SE
    assert r.fuel == FuelType.EURO_95
    assert r.price_eur == Decimal("1.535")
    assert r.price_native == Decimal("17.65")  # price_sek = 1.535 × 11.50 = 17.6525 → 17.65
    assert r.price_native_currency == "SEK"
    assert r.price_sek == Decimal("17.65")  # 1.535 × 11.50 = 17.6525 → 17.65
    assert r.date == date(2026, 6, 22)
    assert r.frequency == "weekly"


@pytest.mark.unit
def test_normalizer_produces_price_record_for_sweden_diesel():
    """GIVEN raw SE diesel record WHEN normalized THEN correct PriceRecord."""
    records = normalize(
        [_raw("SE", "diesel", "1.702")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    assert r.fuel == FuelType.DIESEL
    assert r.price_eur == Decimal("1.702")
    assert r.price_sek == Decimal("19.57")  # 1.702 × 11.50 = 19.573 → 19.57


# ── Denmark (DKK native) ──────────────────────────────────────────────────


@pytest.mark.unit
def test_normalizer_produces_price_record_for_denmark():
    """GIVEN raw DK record WHEN normalized THEN price_native in DKK, price_sek in SEK."""
    records = normalize(
        [_raw("DK", "euro_95", "2.312")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    assert r.country == Country.DK
    assert r.price_eur == Decimal("2.312")
    assert r.price_native == Decimal("17.22")  # 2.312 × 7.45 = 17.2244 → 17.22
    assert r.price_native_currency == "DKK"
    assert r.price_sek == Decimal("26.59")  # 2.312 × 11.50 = 26.588 → 26.59


# ── Finland (EUR native) ──────────────────────────────────────────────────


@pytest.mark.unit
def test_normalizer_produces_price_record_for_finland():
    """GIVEN raw FI record WHEN normalized THEN price_native in EUR, no DKK conversion."""
    records = normalize(
        [_raw("FI", "diesel", "2.173")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    assert r.country == Country.FI
    assert r.price_native == Decimal("2.173")
    assert r.price_native_currency == "EUR"
    assert r.price_sek == Decimal("24.99")  # 2.173 × 11.50 = 24.9895 → 24.99


# ── Decimal rounding (spec scenario) ──────────────────────────────────────


@pytest.mark.unit
def test_decimal_rounding_round_half_up_spec_scenario():
    """1.45 × 11.50 = 16.675 → ROUND_HALF_UP → 16.68 (NOT float banker's 16.67)."""
    records = normalize(
        [_raw("SE", "diesel", "1.45")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    assert r.price_sek == Decimal("16.68")
    # Guard: float would give banker's rounding 16.67
    assert float(r.price_sek) != 16.67


@pytest.mark.unit
def test_decimal_rounding_round_half_up_round_down():
    """16.673 → ROUND_HALF_UP → 16.67 (not rounded up because 3 < 5)."""
    # Simulate: 1.4499 × 11.50 = 16.67385 → 16.67
    records = normalize(
        [_raw("SE", "diesel", "1.4499")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    assert r.price_sek == Decimal("16.67")


@pytest.mark.unit
def test_decimal_rounding_round_half_up_round_up():
    """16.675 → ROUND_HALF_UP → 16.68."""
    records = normalize(
        [_raw("SE", "diesel", "1.45001")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    r = records[0]
    # 1.45001 × 11.50 = 16.675115 → ROUND_HALF_UP → 16.68
    assert r.price_sek == Decimal("16.68")


# ── Missing fields (spec scenario) ────────────────────────────────────────


@pytest.mark.unit
def test_normalizer_drops_missing_price_eur():
    """GIVEN raw record without price_eur WHEN normalized THEN dropped."""
    raw = {"country": "SE", "fuel": "euro_95", "date": date(2026, 6, 22)}
    # No 'price_eur' key

    records = normalize([raw], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"))

    assert len(records) == 0


@pytest.mark.unit
def test_normalizer_drops_missing_country():
    """GIVEN raw record without country WHEN normalized THEN dropped."""
    raw = {
        "fuel": "euro_95",
        "price_eur": Decimal("1.535"),
        "date": date(2026, 6, 22),
    }

    records = normalize([raw], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"))

    assert len(records) == 0


@pytest.mark.unit
def test_normalizer_drops_missing_fuel():
    """GIVEN raw record without fuel WHEN normalized THEN dropped."""
    raw = {
        "country": "SE",
        "price_eur": Decimal("1.535"),
        "date": date(2026, 6, 22),
    }

    records = normalize([raw], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"))

    assert len(records) == 0


@pytest.mark.unit
def test_normalizer_keeps_valid_records_when_some_invalid():
    """GIVEN mix of valid and invalid records WHEN normalized THEN invalid dropped, valid kept."""
    records = normalize(
        [
            _raw("SE", "euro_95", "1.535"),
            {"country": "DK"},  # missing fuel and price_eur
            _raw("FI", "diesel", "2.173"),
            {},  # completely empty
        ],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    assert len(records) == 2
    countries = {r.country for r in records}
    assert countries == {Country.SE, Country.FI}


# ── Edge cases ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_normalizer_handles_empty_input():
    """GIVEN empty list WHEN normalized THEN empty list returned (no crash)."""
    records = normalize([], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"))
    assert records == []


@pytest.mark.unit
def test_normalizer_drops_record_with_none_date():
    """GIVEN raw record with date=None WHEN normalized THEN dropped (date is required)."""
    raw = _raw("SE", "euro_95", "1.535", record_date=None)

    records = normalize([raw], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"))

    assert len(records) == 0


@pytest.mark.unit
def test_normalizer_sets_frequency_weekly_for_all_eu_records():
    """GIVEN any EU raw record WHEN normalized THEN frequency is 'weekly'."""
    records = normalize(
        [
            _raw("SE", "euro_95", "1.5"),
            _raw("DK", "diesel", "1.9"),
            _raw("FI", "euro_95", "2.0"),
        ],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
    )

    assert len(records) == 3
    for r in records:
        assert r.frequency == "weekly"


# ── Norway (NOK native, from SSB) ─────────────────────────────────────────


def _raw_no(
    fuel: str = "euro_95",
    price_nok: str = "21.50",
    *,
    record_date: date | None = _DEFAULT_DATE,
) -> dict[str, object]:
    """Factory for a raw NO record from SSB parser (price_nok, not price_eur)."""
    return {
        "country": "NO",
        "fuel": fuel,
        "price_nok": Decimal(price_nok),
        "date": record_date,
    }


@pytest.mark.unit
def test_normalizer_produces_price_record_for_norway_euro95():
    """GIVEN raw NO euro_95 record WHEN normalized THEN correct PriceRecord.

    price_eur = price_nok / eur_nok = 21.50 / 12.00 = 1.7916... → 1.79
    price_sek = 1.79 × 11.50 = 20.585 → 20.59
    """
    records = normalize(
        [_raw_no("euro_95", "21.50")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
        eur_nok=Decimal("12.00"),
    )

    assert len(records) == 1
    r = records[0]
    assert r.country == Country.NO
    assert r.fuel == FuelType.EURO_95
    assert r.price_eur == Decimal("1.79")  # 21.50 / 12.00 = 1.7916... → 1.79
    assert r.price_native == Decimal("21.50")
    assert r.price_native_currency == "NOK"
    assert r.price_sek == Decimal("20.59")  # 1.79 × 11.50 = 20.585 → 20.59
    assert r.date == date(2026, 6, 22)
    assert r.frequency == "monthly"


@pytest.mark.unit
def test_normalizer_produces_price_record_for_norway_diesel():
    """GIVEN raw NO diesel record WHEN normalized THEN correct PriceRecord."""
    records = normalize(
        [_raw_no("diesel", "19.80")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
        eur_nok=Decimal("12.00"),
    )

    r = records[0]
    assert r.fuel == FuelType.DIESEL
    assert r.price_native == Decimal("19.80")
    assert r.price_eur == Decimal("1.65")  # 19.80 / 12.00 = 1.65
    assert r.price_sek == Decimal("18.98")  # 1.65 × 11.50 = 18.975 → 18.98


@pytest.mark.unit
def test_normalizer_no_decimal_rounding_round_half_up():
    """NO EUR conversion: 20.00 / 12.00 = 1.6666... → ROUND_HALF_UP → 1.67.

    Then price_sek = 1.67 × 11.50 = 19.205 → 19.21
    """
    records = normalize(
        [_raw_no("euro_95", "20.00")],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
        eur_nok=Decimal("12.00"),
    )

    r = records[0]
    assert r.price_eur == Decimal("1.67")
    assert r.price_sek == Decimal("19.21")


@pytest.mark.unit
def test_normalizer_sets_frequency_monthly_for_no_records():
    """GIVEN NO raw records WHEN normalized THEN frequency is 'monthly'."""
    records = normalize(
        [
            _raw_no("euro_95", "21.50"),
            _raw_no("diesel", "19.80"),
        ],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
        eur_nok=Decimal("12.00"),
    )

    assert len(records) == 2
    for r in records:
        assert r.frequency == "monthly"


@pytest.mark.unit
def test_normalizer_handles_mixed_se_dk_fi_no_records():
    """GIVEN mix of SE, DK, FI, NO records WHEN normalized THEN all returned correctly."""
    records = normalize(
        [
            _raw("SE", "euro_95", "1.535"),
            _raw("DK", "diesel", "1.900"),
            _raw("FI", "euro_95", "2.152"),
            _raw_no("euro_95", "21.50"),
            _raw_no("diesel", "19.80"),
        ],
        eur_sek=Decimal("11.50"),
        eur_dkk=Decimal("7.45"),
        eur_nok=Decimal("12.00"),
    )

    assert len(records) == 5
    currencies = {r.price_native_currency for r in records}
    assert currencies == {"SEK", "EUR", "DKK", "NOK"}
    frequencies = {r.frequency for r in records}
    assert frequencies == {"weekly", "monthly"}


@pytest.mark.unit
def test_normalizer_drops_missing_price_nok_for_no():
    """GIVEN NO record without price_nok (and no price_eur) WHEN normalized THEN dropped."""
    raw = {"country": "NO", "fuel": "euro_95", "date": date(2026, 6, 22)}

    records = normalize(
        [raw], eur_sek=Decimal("11.50"), eur_dkk=Decimal("7.45"), eur_nok=Decimal("12.00")
    )

    assert len(records) == 0
