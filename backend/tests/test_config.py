"""Tests for config.py — Pydantic Settings with defaults."""

from decimal import Decimal
from pathlib import Path

import pytest


def test_settings_defaults(monkeypatch):
    """Settings must have sensible defaults for all fields."""
    # Clear any env vars that might interfere
    for key in (
        "FUEL_PRICES_EU_URL",
        "SSB_API_URL",
        "ECB_API_URL",
        "CACHE_DIR",
        "EU_CACHE_WINDOW_DAYS",
        "SSB_CACHE_WINDOW_DAYS",
        "EUR_SEK_FALLBACK",
        "EUR_DKK_FALLBACK",
        "EUR_NOK_FALLBACK",
        "RETRY_AFTER_SECONDS",
        "VALID_COUNTRIES",
    ):
        monkeypatch.delenv(key, raising=False)

    from config import Settings

    settings = Settings()

    # URLs must be sensible endpoints
    assert "fuel-prices.eu" in settings.fuel_prices_eu_url
    assert "ssb.no" in settings.ssb_api_url
    assert "ecb" in settings.ecb_api_url.lower()

    # Cache dir defaults to ./cache
    assert settings.cache_dir == Path("cache")

    # Windows
    assert settings.eu_cache_window_days == 7
    assert settings.ssb_cache_window_days == 30

    # Fallback rates (must be Decimal)
    assert isinstance(settings.eur_sek_fallback, Decimal)
    assert isinstance(settings.eur_dkk_fallback, Decimal)
    assert isinstance(settings.eur_nok_fallback, Decimal)
    assert settings.eur_sek_fallback > 0
    assert settings.eur_dkk_fallback > 0
    assert settings.eur_nok_fallback > 0

    # Retry-After
    assert settings.retry_after_seconds == 300

    # Valid countries
    assert "SE" in settings.valid_countries
    assert "DK" in settings.valid_countries
    assert "FI" in settings.valid_countries
    assert "NO" in settings.valid_countries
    assert "IS" in settings.valid_countries
    assert len(settings.valid_countries) == 5


def test_settings_override_from_env(monkeypatch):
    """Settings must read from environment variables (Pydantic Settings behavior)."""
    monkeypatch.setenv("FUEL_PRICES_EU_URL", "https://custom.eu/prices.txt")
    monkeypatch.setenv("CACHE_DIR", "/tmp/nordicpump-cache")
    monkeypatch.setenv("EU_CACHE_WINDOW_DAYS", "14")
    monkeypatch.setenv("EUR_SEK_FALLBACK", "12.00")

    from config import Settings

    settings = Settings()

    assert settings.fuel_prices_eu_url == "https://custom.eu/prices.txt"
    assert settings.cache_dir == Path("/tmp/nordicpump-cache")
    assert settings.eu_cache_window_days == 14
    assert settings.eur_sek_fallback == Decimal("12.00")


def test_cache_dir_is_path():
    """cache_dir must be a pathlib.Path."""
    from config import Settings

    settings = Settings()
    assert isinstance(settings.cache_dir, Path)


def test_valid_countries_are_uppercase():
    """All valid country codes must be uppercase."""
    from config import Settings

    settings = Settings()

    for country in settings.valid_countries:
        assert country == country.upper()
        assert len(country) == 2


def test_settings_immutability():
    """Settings should be effectively frozen (Pydantic default is immutable BaseSettings)."""
    from config import Settings

    settings = Settings()

    with pytest.raises(Exception):
        settings.eu_cache_window_days = 999  # type: ignore[misc]


def test_retry_after_is_positive():
    """Retry-After must be a positive integer."""
    from config import Settings

    settings = Settings()
    assert settings.retry_after_seconds > 0
    assert isinstance(settings.retry_after_seconds, int)
