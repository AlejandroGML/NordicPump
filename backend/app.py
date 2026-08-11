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
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from litestar import Litestar, Request, Response
from litestar.config.cors import CORSConfig

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
        route_handlers=[prices_router, rates_router, health_router],
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
