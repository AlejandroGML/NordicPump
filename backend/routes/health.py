"""GET /health — service health check endpoint.

Returns ``{"status": "ok", "timestamp": "<ISO-8601>"}`` with HTTP 200.
"""

from __future__ import annotations

from datetime import UTC, datetime

from litestar import Router, get


@get("/health")
async def health_check() -> dict[str, str]:
    """Health check — always returns 200 with current UTC timestamp."""
    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
    }


health_router = Router(path="/", route_handlers=[health_check])
