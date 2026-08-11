"""NordicPump backend configuration via Pydantic Settings.

All values read from environment variables (uppercase, e.g. FUEL_PRICES_EU_URL),
with sensible defaults suitable for local development.

Settings is a frozen pydantic-settings BaseSettings — all attributes are
read-only after construction. Cache directory, URLs, fallback rates, and
refresh windows are configured here.
"""

from decimal import Decimal
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from models.countries import VALID_COUNTRIES


class Settings(BaseSettings):
    """Application settings with env-var overrides."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        frozen=True,
    )

    # --- Upstream URLs ---

    fuel_prices_eu_url: str = (
        "https://www.fuel-prices.eu/llms.txt"
    )
    ssb_api_url: str = (
        "https://data.ssb.no/api/v0/en/table/09654"
    )
    ecb_api_url: str = (
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    )

    # --- Cache ---

    cache_dir: Path = Path("cache")

    # --- Refresh windows ---

    eu_cache_window_days: int = 7
    ssb_cache_window_days: int = 30
    iceland_cache_window_days: int = 2

    # --- Fallback currency rates (used when ECB is unreachable) ---
    # Source: ECB reference rates, updated manually or via env

    eur_sek_fallback: Decimal = Decimal("11.50")
    eur_dkk_fallback: Decimal = Decimal("7.45")
    eur_nok_fallback: Decimal = Decimal("12.00")
    eur_isk_fallback: Decimal = Decimal("140.00")

    # --- API behavior ---

    retry_after_seconds: int = 300
    valid_countries: list[str] = VALID_COUNTRIES
    dev_mode: bool = False
