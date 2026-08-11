"""GET /api/v1/rates — current EUR→SEK/DKK/NOK reference rates.

Exposes the ECB rates (or config fallbacks) used by the ingestion
pipeline, so the frontend can convert prices into the user's chosen
currency without duplicating rate logic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from litestar import Response, Router, get

if TYPE_CHECKING:
    from services.ingestion_pipeline import IngestionPipeline

# Backend rate keys (ECB style) → public currency codes.
from models.countries import RATE_KEYS as _RATE_KEYS


def create_rates_router(pipeline: IngestionPipeline) -> Router:
    """Factory: create a Litestar Router exposing conversion rates."""

    @get("/api/v1/rates")
    async def rates_endpoint() -> Response[dict[str, object]]:
        """Serve EUR→X rates as floats: {"base": "EUR", "rates": {"SEK": ..., ...}}."""
        rates = await pipeline.get_rates()
        return Response(
            content={
                "base": "EUR",
                "rates": {public: float(rates[key]) for key, public in _RATE_KEYS.items()},
            },
            status_code=200,
            media_type="application/json",
        )

    return Router(path="/", route_handlers=[rates_endpoint])
