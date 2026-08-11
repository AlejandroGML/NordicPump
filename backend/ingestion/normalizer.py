"""Normalize raw ingestion records into the unified PriceRecord schema.

Applies currency conversions using Decimal arithmetic with ROUND_HALF_UP
rounding (matching the spec: ``1.45 × 11.50 = 16.68``).

Rules:
- SE: ``price_native = price_sek``, ``price_native_currency = "SEK"``
- FI: ``price_native = price_eur``, ``price_native_currency = "EUR"``
- DK: ``price_native = price_eur × eur_dkk``, ``price_native_currency = "DKK"``
- NO: ``price_eur = price_nok / eur_nok``, ``price_native = price_nok``,
  ``price_native_currency = "NOK"``
- IS: ``price_eur = price_isk / eur_isk``, ``price_native = price_isk``,
  ``price_native_currency = "ISK"``
- ``price_sek = price_eur × eur_sek`` (all countries)
- Rounds to 2 decimal places with ROUND_HALF_UP
- Drops records missing any required field (warns, does not crash)
- frequency: ``"weekly"`` (EU) or ``"monthly"`` (NO)
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache

from models.price import Country, FuelType, PriceRecord

logger = logging.getLogger(__name__)

# EU records must have price_eur; NO/IS records must have their native price.
_REQUIRED_EU_FIELDS = frozenset({"country", "fuel", "price_eur"})
_REQUIRED_NO_FIELDS = frozenset({"country", "fuel", "price_nok"})
_REQUIRED_IS_FIELDS = frozenset({"country", "fuel", "price_isk"})

# Quantize to 2 decimal places with standard rounding.
_TWO_PLACES = Decimal("0.01")


def normalize(
    raw_records: list[dict[str, object]],
    *,
    eur_sek: Decimal,
    eur_dkk: Decimal,
    eur_nok: Decimal = Decimal("0"),
    eur_isk: Decimal = Decimal("0"),
) -> list[PriceRecord]:
    """Normalize raw ingestion records into PriceRecord objects.

    Args:
        raw_records: Dicts with ``country``, ``fuel``, ``price_eur``
            (EU countries) or ``price_nok`` (NO) or ``price_isk`` (IS),
            and optionally ``date``.
        eur_sek: EUR → SEK conversion rate (Decimal).
        eur_dkk: EUR → DKK conversion rate (Decimal).
        eur_nok: EUR → NOK conversion rate (Decimal), required for NO records.
        eur_isk: EUR → ISK conversion rate (Decimal), required for IS records.
    """
    result: list[PriceRecord] = []

    for raw in raw_records:
        raw_keys = set(raw.keys())

        try:
            country = Country(raw["country"])  # type: ignore[arg-type]
            fuel = FuelType(raw["fuel"])  # type: ignore[arg-type]
        except (KeyError, ValueError):
            logger.warning(
                "Dropping record with invalid enum value: %s",
                raw,
            )
            continue

        record_date: date | None = raw.get("date")  # type: ignore[assignment]

        # Drop records without a valid date — PriceRecord.date is required.
        if not isinstance(record_date, date):
            logger.warning(
                "Dropping record with missing/invalid date for %s/%s",
                country,
                fuel,
            )
            continue

        # ── Norway: price_nok must be present, compute price_eur ──────────
        if country == Country.NO:
            missing = _REQUIRED_NO_FIELDS - raw_keys
            if missing:
                logger.warning(
                    "Dropping NO record with missing fields %s: %s",
                    missing,
                    raw.get("country", "?"),
                )
                continue

            if eur_nok <= 0:
                logger.warning(
                    "Dropping NO record — invalid eur_nok rate: %s", eur_nok
                )
                continue

            price_nok = _to_decimal(raw["price_nok"])
            price_eur = _round2(price_nok / eur_nok)
            price_sek = _round2(price_eur * eur_sek)

            result.append(
                PriceRecord(
                    country=country,
                    fuel=fuel,
                    price_eur=price_eur,
                    price_native=price_nok,
                    price_native_currency="NOK",
                    price_sek=price_sek,
                    date=record_date,
                    frequency="monthly",
                )
            )
            continue

        # ── Iceland: price_isk must be present, compute price_eur ────────
        if country == Country.IS:
            missing = _REQUIRED_IS_FIELDS - raw_keys
            if missing:
                logger.warning(
                    "Dropping IS record with missing fields %s: %s",
                    missing,
                    raw.get("country", "?"),
                )
                continue

            if eur_isk <= 0:
                logger.warning(
                    "Dropping IS record — invalid eur_isk rate: %s", eur_isk
                )
                continue

            price_isk = _to_decimal(raw["price_isk"])
            price_eur = _round2(price_isk / eur_isk)
            price_sek = _round2(price_eur * eur_sek)

            result.append(
                PriceRecord(
                    country=country,
                    fuel=fuel,
                    price_eur=price_eur,
                    price_native=price_isk,
                    price_native_currency="ISK",
                    price_sek=price_sek,
                    date=record_date,
                    frequency="weekly",
                )
            )
            continue

        # ── EU countries ─────────────────────────────────────────────────
        missing = _REQUIRED_EU_FIELDS - raw_keys
        if missing:
            logger.warning(
                "Dropping record with missing fields %s: %s",
                missing,
                raw.get("country", "?"),
            )
            continue

        price_eur = _to_decimal(raw["price_eur"])

        # EUR → SEK (all countries)
        price_sek = _round2(price_eur * eur_sek)

        # Native currency
        if country == Country.SE:
            price_native = price_sek
            price_native_currency = "SEK"
        elif country == Country.FI:
            price_native = price_eur
            price_native_currency = "EUR"
        elif country == Country.DK:
            price_native = _round2(price_eur * eur_dkk)
            price_native_currency = "DKK"
        else:
            logger.warning(
                "Dropping unsupported country in normalizer: %s", country
            )
            continue

        result.append(
            PriceRecord(
                country=country,
                fuel=fuel,
                price_eur=price_eur,
                price_native=price_native,
                price_native_currency=price_native_currency,
                price_sek=price_sek,
                date=record_date,
                frequency="weekly",
            )
        )

    return result


@lru_cache(maxsize=128)
def _round2(value: Decimal) -> Decimal:
    """Round *value* to 2 decimal places using ROUND_HALF_UP.

    Memoized — the same Decimal value is rounded at most once per
    process lifetime (pure function, safe to cache).
    """
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


@lru_cache(maxsize=128)
def _to_decimal(value: object) -> Decimal:
    """Coerce *value* to Decimal if it is not already one.

    Memoized — the same raw value (e.g. ``"11.50"``) is converted
    at most once per process lifetime (pure function, safe to cache).
    """
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))
