"""NordicPump price models — unified fuel price schema.

═══════════════════════════════════════════════════════════════════
MUST stay in sync with frontend/src/app/shared/models/price.ts — PriceRecord.
Validated by frontend price.contract.spec.ts (field names + enum values).
═══════════════════════════════════════════════════════════════════
"""

from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from models.countries import Country as Country  # noqa: F401 — re-exported for existing imports


class FuelType(StrEnum):
    EURO_95 = "euro_95"
    DIESEL = "diesel"


class PriceRecord(BaseModel):
    """Normalized fuel price for one country + fuel type."""

    country: Country
    fuel: FuelType
    price_eur: Decimal
    price_native: Decimal
    price_native_currency: str
    price_sek: Decimal
    date: date
    frequency: str


class PriceResponse(BaseModel):
    """API response envelope for price queries."""

    country: Country
    prices: list[PriceRecord]
