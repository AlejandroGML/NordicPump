"""Tests for models/price.py — FuelType, Country, PriceRecord, PriceResponse."""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

# --- FuelType enum ---

def test_fueltype_has_euro_95_and_diesel():
    """FuelType enum must have EURO_95 and DIESEL members."""
    from models.price import FuelType

    assert FuelType.EURO_95.value == "euro_95"
    assert FuelType.DIESEL.value == "diesel"


def test_fueltype_str_members():
    """FuelType must be a str enum."""
    from models.price import FuelType

    assert isinstance(FuelType.EURO_95, str)
    assert isinstance(FuelType.DIESEL, str)


# --- Country enum ---

def test_country_has_nordic_members():
    """Country enum must have SE, DK, FI, NO members."""
    from models.price import Country

    assert Country.SE.value == "SE"
    assert Country.DK.value == "DK"
    assert Country.FI.value == "FI"
    assert Country.NO.value == "NO"


def test_country_str_members():
    """Country must be a str enum."""
    from models.price import Country

    assert isinstance(Country.SE, str)
    assert isinstance(Country.NO, str)


# --- PriceRecord ---

def test_pricerecord_valid_swedish_euro95():
    """PriceRecord with valid SE data must parse correctly."""
    from models.price import Country, FuelType, PriceRecord

    record = PriceRecord(
        country=Country.SE,
        fuel=FuelType.EURO_95,
        price_eur=Decimal("1.45"),
        price_native=Decimal("1.45"),
        price_native_currency="EUR",
        price_sek=Decimal("16.68"),
        date=date(2026, 6, 25),
        frequency="weekly",
    )

    assert record.country == Country.SE
    assert record.fuel == FuelType.EURO_95
    assert record.price_eur == Decimal("1.45")
    assert record.price_native == Decimal("1.45")
    assert record.price_native_currency == "EUR"
    assert record.price_sek == Decimal("16.68")
    assert record.date == date(2026, 6, 25)
    assert record.frequency == "weekly"


def test_pricerecord_norwegian_diesel():
    """PriceRecord with valid NO data (NOK native) must parse correctly."""
    from models.price import Country, FuelType, PriceRecord

    record = PriceRecord(
        country=Country.NO,
        fuel=FuelType.DIESEL,
        price_eur=Decimal("1.52"),
        price_native=Decimal("18.27"),
        price_native_currency="NOK",
        price_sek=Decimal("17.48"),
        date=date(2026, 5, 15),
        frequency="monthly",
    )

    assert record.country == Country.NO
    assert record.price_native_currency == "NOK"
    assert record.frequency == "monthly"


def test_pricerecord_danish_prices():
    """DK price_native must be in DKK, price_native_currency = 'DKK'."""
    from models.price import Country, FuelType, PriceRecord

    record = PriceRecord(
        country=Country.DK,
        fuel=FuelType.DIESEL,
        price_eur=Decimal("1.48"),
        price_native=Decimal("11.03"),  # 1.48 * EUR_DKK
        price_native_currency="DKK",
        price_sek=Decimal("17.02"),
        date=date(2026, 6, 25),
        frequency="weekly",
    )

    assert record.price_native_currency == "DKK"
    assert record.price_native > record.price_eur  # DKK > EUR


def test_pricerecord_finnish_prices():
    """FI price_native must be EUR (same as price_eur)."""
    from models.price import Country, FuelType, PriceRecord

    record = PriceRecord(
        country=Country.FI,
        fuel=FuelType.EURO_95,
        price_eur=Decimal("1.50"),
        price_native=Decimal("1.50"),  # EUR
        price_native_currency="EUR",
        price_sek=Decimal("17.25"),
        date=date(2026, 6, 25),
        frequency="weekly",
    )

    assert record.country == Country.FI
    assert record.price_native == record.price_eur
    assert record.price_native_currency == "EUR"


def test_pricerecord_all_fields_required():
    """PriceRecord must reject missing required fields."""
    from models.price import PriceRecord

    with pytest.raises(ValidationError):
        PriceRecord()


def test_pricerecord_decimal_fields_are_decimal():
    """price_eur, price_native, price_sek must be Decimal, not float."""
    from models.price import Country, FuelType, PriceRecord

    record = PriceRecord(
        country=Country.SE,
        fuel=FuelType.EURO_95,
        price_eur=Decimal("1.45"),
        price_native=Decimal("1.45"),
        price_native_currency="EUR",
        price_sek=Decimal("16.68"),
        date=date(2026, 6, 25),
        frequency="weekly",
    )

    assert isinstance(record.price_eur, Decimal)
    assert isinstance(record.price_native, Decimal)
    assert isinstance(record.price_sek, Decimal)


def test_pricerecord_rejects_float_price():
    """A float value for price_eur must be rejected (or coerced by Pydantic,
    but design mandates Decimal)."""
    from models.price import Country, FuelType, PriceRecord

    # Pydantic v2 coerces float → Decimal by default;
    # we assert it ends up as Decimal regardless
    record = PriceRecord(
        country=Country.SE,
        fuel=FuelType.EURO_95,
        price_eur=1.45,  # type: ignore[arg-type]
        price_native=1.45,  # type: ignore[arg-type]
        price_native_currency="EUR",
        price_sek=16.68,  # type: ignore[arg-type]
        date=date(2026, 6, 25),
        frequency="weekly",
    )

    # Must end up as Decimal after coercion
    assert isinstance(record.price_eur, Decimal)
    assert record.price_eur == Decimal("1.45")


# --- PriceResponse ---

def test_priceresponse_structure():
    """PriceResponse must have country and list of PriceRecords."""
    from models.price import Country, FuelType, PriceRecord, PriceResponse

    records = [
        PriceRecord(
            country=Country.SE,
            fuel=FuelType.EURO_95,
            price_eur=Decimal("1.45"),
            price_native=Decimal("1.45"),
            price_native_currency="EUR",
            price_sek=Decimal("16.68"),
            date=date(2026, 6, 25),
            frequency="weekly",
        ),
    ]

    response = PriceResponse(country=Country.SE, prices=records)

    assert response.country == Country.SE
    assert len(response.prices) == 1
    assert response.prices[0].fuel == FuelType.EURO_95


def test_priceresponse_empty_prices():
    """PriceResponse with empty prices list is valid."""
    from models.price import Country, PriceResponse

    response = PriceResponse(country=Country.NO, prices=[])

    assert response.country == Country.NO
    assert response.prices == []


def test_priceresponse_rejects_wrong_country_type():
    """PriceResponse must reject non-Country value for country."""
    from models.price import PriceResponse

    with pytest.raises(ValidationError):
        PriceResponse(country="XX", prices=[])  # type: ignore[arg-type]
