"""Generated file — DO NOT EDIT. Run: python scripts/generate_countries.py."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Country(StrEnum):
    SE = "SE"
    DK = "DK"
    FI = "FI"
    NO = "NO"
    IS = "IS"


@dataclass(frozen=True)
class CountryMeta:
    """Metadata for a Nordic country (single source: countries.json)."""

    currency: str
    """Native currency code (ISO 4217)."""
    source: str
    """Upstream data source key (cache source id)."""
    freshness_window: str
    """Settings attribute holding the freshness window in days."""
    rates_public: bool
    """Whether this currency is exposed via GET /api/v1/rates."""


COUNTRIES: dict[Country, CountryMeta] = {
    Country.SE: CountryMeta(
        currency="SEK",
        source="fuel-prices-eu",
        freshness_window="eu_cache_window_days",
        rates_public=True,
    ),
    Country.DK: CountryMeta(
        currency="DKK",
        source="fuel-prices-eu",
        freshness_window="eu_cache_window_days",
        rates_public=True,
    ),
    Country.FI: CountryMeta(
        currency="EUR",
        source="fuel-prices-eu",
        freshness_window="eu_cache_window_days",
        rates_public=False,
    ),
    Country.NO: CountryMeta(
        currency="NOK",
        source="ssb-no",
        freshness_window="ssb_cache_window_days",
        rates_public=True,
    ),
    Country.IS: CountryMeta(
        currency="ISK",
        source="iceland-is",
        freshness_window="iceland_cache_window_days",
        rates_public=False,
    ),
}


# ── Derived maps (do not edit by hand) ─────────────────────────────
COUNTRY_SOURCE: dict[Country, str] = {c: m.source for c, m in COUNTRIES.items()}
SOURCE_WINDOW_DAYS: dict[str, str] = {m.source: m.freshness_window for m in COUNTRIES.values()}
RATE_KEYS: dict[str, str] = {
    f"EUR_{m.currency}": m.currency
    for m in COUNTRIES.values()
    if m.rates_public
}
VALID_COUNTRIES: list[str] = [c.value for c in Country]
