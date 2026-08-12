"""NordicPump API application — Litestar assembly.

Wires together:
  - Price service, cache, and ingestion
  - Route handlers (prices, health)
  - Exception handlers → typed error envelopes
  - Background scheduler via lifespan
  - CORS middleware (dev mode)
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from litestar import Litestar, Request, Response, get
from litestar.config.cors import CORSConfig
from litestar.exceptions import HTTPException
from litestar.response import File

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from routes.health import health_router
from routes.prices import create_prices_router
from routes.rates import create_rates_router
from scheduler import run_scheduler
from services.ingestion_pipeline import IngestionPipeline
from services.price_query import PriceQueryService

logger = logging.getLogger(__name__)

# Media types for static SPA assets served by the fallback handler.
_STATIC_MEDIA: dict[str, str] = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
}


def _frontend_dist() -> Path | None:
    """Resolve the compiled frontend directory from FRONTEND_DIST_DIR."""
    dist = os.environ.get("FRONTEND_DIST_DIR", "")
    if not dist:
        return None
    p = Path(dist)
    return p if p.is_dir() else None


@get(["/", "/{path:path}"])
async def spa_fallback(path: str = "") -> File:
    """Serve the compiled Angular SPA (single container deployment).

    Registered LAST in route_handlers so API routes take precedence.
    Returns index.html for unknown paths (SPA routing), static assets
    with the correct media type and inline disposition.
    """
    dist = _frontend_dist()
    if dist is None:
        raise HTTPException(detail="Frontend not configured", status_code=404)

    # Never intercept API routes — let them 404 normally
    first = path.split("/", 1)[0]
    if first in {"api", "health", "schema", "docs"}:
        raise HTTPException(detail="Not found", status_code=404)

    # GOTCHA: Litestar passes the path with a leading "/" — strip it or
    # dist/path escapes the directory and falls through to the fallback.
    rel = path.lstrip("/")
    candidate = (dist / rel).resolve()
    if candidate.is_file() and dist.resolve() in candidate.parents:
        media = _STATIC_MEDIA.get(candidate.suffix.lower())
        # GOTCHA: File() defaults to attachment + octet-stream — the
        # browser would download instead of rendering. Always inline.
        return File(
            candidate,
            media_type=media or "application/octet-stream",
            content_disposition_type="inline",
        )

    index = dist / "index.html"
    if index.is_file():
        return File(index, media_type="text/html", content_disposition_type="inline")
    raise HTTPException(detail="Frontend not built", status_code=404)


def create_app(store: CacheStore, freshness: CacheFreshness, settings: Settings) -> Litestar:
    """Build and return a fully-wired Litestar application.

    Args:
        store: CacheStore instance for price data persistence.
        freshness: CacheFreshness for cache window checks.
        settings: Application configuration (URLs, windows, fallback rates).
    """
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    query = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)
    prices_router = create_prices_router(query, settings)
    rates_router = create_rates_router(pipeline)

    # ── Lifespan: start/stop background scheduler ──────────────────────

    @asynccontextmanager
    async def lifespan(app: Litestar) -> AsyncGenerator[None]:
        """Start background scheduler on app startup, cancel on shutdown."""
        scheduler_task = asyncio.create_task(
            run_scheduler(pipeline, freshness, settings),
            name="price-ingestion-scheduler",
        )
        logger.info("Background scheduler started")
        try:
            yield
        finally:
            scheduler_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await scheduler_task
            await pipeline.close()
            logger.info("Background scheduler stopped")

    # ── CORS: permissive for local development, restricted in production ─
    if settings.dev_mode:
        cors_config = CORSConfig(
            allow_origins=["*"],
            allow_methods=["GET", "OPTIONS"],
            allow_headers=["*"],
        )
    else:
        logger.warning(
            "Running outside dev mode without explicitly configured CORS origin — "
            "set NORDICPUMP_CORS_ORIGIN or add dev_mode=false in .env"
        )
        cors_config = CORSConfig(
            allow_origins=["http://localhost:4200"],
            allow_methods=["GET", "OPTIONS"],
            allow_headers=["*"],
        )

    # ── Generic error handler for unexpected exceptions ───────────────

    def internal_error_handler(_request: Request[Any, Any, Any], exc: Exception) -> Response[Any]:
        """Catch unhandled exceptions and return a safe 500 envelope."""
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        body = json.dumps(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred. Please try again later.",
                }
            }
        )
        return Response(
            content=body,
            status_code=500,
            media_type="application/json",
        )

    # ── Assemble ───────────────────────────────────────────────────────

    return Litestar(
        route_handlers=[prices_router, rates_router, health_router, spa_fallback],
        lifespan=[lifespan],
        cors_config=cors_config,
        exception_handlers={
            Exception: internal_error_handler,
        },
    )


def create_app_from_env() -> Litestar:
    """Convenience factory: build app using Settings from environment/.env.

    Used by uvicorn --factory for production deployment:
    ``uvicorn app:create_app_from_env --factory``
    """
    settings = Settings()
    cache_dir = settings.cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    store = CacheStore(cache_dir=cache_dir)
    freshness = CacheFreshness(cache_dir=cache_dir)
    return create_app(store, freshness, settings)
