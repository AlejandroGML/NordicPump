"""GET /api/v1/prices/{country} — Nordic fuel prices endpoint.

Maps typed AppError subclasses to HTTP status codes and the standard
error envelope ``{"error": {"code": "...", "message": "..."}}``.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from litestar import Request, Response, Router, get

from config import Settings
from models.errors import AppError, CacheMissError, UnsupportedCountryError
from models.price import Country

if TYPE_CHECKING:
    from services.price_query import PriceQueryService


def create_prices_router(service: PriceQueryService, settings: Settings) -> Router:
    """Factory: create a Litestar Router wired to *service*."""

    retry_after = str(settings.retry_after_seconds)

    @get("/api/v1/prices/{country:str}")
    async def prices_endpoint(
        request: Request[Any, Any, Any],
        country: str,
    ) -> Response[Any]:
        """Serve normalized fuel prices for *country* (se, dk, fi, no)."""
        # ── Validate country ──────────────────────────────────────────
        try:
            target = Country(country.upper())
        except ValueError:
            raise UnsupportedCountryError.for_country(country)

        # ── Resolve via service ───────────────────────────────────────
        result, cache_status = await service.resolve(target)

        body = json.dumps(result.model_dump(mode='json'))
        return Response(
            content=body,
            status_code=200,
            media_type="application/json",
            headers={"X-Cache": cache_status},
        )

    # ── Error handlers ──────────────────────────────────────────────────

    def unsupported_country_handler(
        _request: Request[Any, Any, Any], exc: UnsupportedCountryError,
    ) -> Response[Any]:
        return Response(
            content=_error_body(exc),
            status_code=404,
            media_type="application/json",
        )

    def cache_miss_handler(_request: Request[Any, Any, Any], exc: CacheMissError) -> Response[Any]:
        return Response(
            content=_error_body(exc, code="SERVICE_UNAVAILABLE"),
            status_code=503,
            media_type="application/json",
            headers={"Retry-After": retry_after},
        )

    def upstream_error_handler(_request: Request[Any, Any, Any], exc: AppError) -> Response[Any]:
        return Response(
            content=_error_body(exc, code="SERVICE_UNAVAILABLE"),
            status_code=503,
            media_type="application/json",
            headers={"Retry-After": retry_after},
        )

    router = Router(
        path="/",
        route_handlers=[prices_endpoint],
        exception_handlers={
            UnsupportedCountryError: unsupported_country_handler,
            CacheMissError: cache_miss_handler,
            AppError: upstream_error_handler,
        },
    )

    return router


def _error_body(exc: AppError, code: str | None = None) -> str:
    """Return the standard JSON error envelope as a string."""
    effective_code = code or exc.code
    return json.dumps({"error": {"code": effective_code, "message": exc.message}})
