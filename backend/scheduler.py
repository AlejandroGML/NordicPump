"""Background ingestion scheduler with independent cadences.

Uses ``asyncio.sleep()`` loops in the Litestar lifespan — no external
scheduler dependencies (no Celery, no APScheduler).

Cadences (independent loops via ``asyncio.gather``):
  - EU (fuel_prices_eu): daily check, ingests only on Sunday (when the
    fuel APIs publish their weekly snapshot)
  - SSB (NO prices): daily check, ingests on new month (1st) AND on the
    15th (SSB's mid-month publish day) — picks up the fresh snapshot ASAP
  - Iceland (gasvaktin): ingests when the cache is stale (2-day window —
    station prices change often but the national average is stable)
  - ECB (reference rates): daily, always ingests

Each loop is fully independent — a failure in one does not block the others.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from cadence import is_new_month, is_ssb_publish_day, is_sunday

if TYPE_CHECKING:
    from cache.cache_freshness import CacheFreshness
    from services.ingestion_pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

_HOUR = 3600  # Check cadence every hour


async def run_scheduler(
    pipeline: IngestionPipeline,
    freshness: CacheFreshness,
    settings: object | None = None,  # noqa: ARG001 — kept for backwards compat
) -> None:
    """Launch three independent async ingestion loops via ``asyncio.gather``.

    - EU loop: checks hourly, ingests on Sunday only if cache is stale
    - SSB loop: checks hourly, ingests on new month (1st) and on the 15th
    - Iceland loop: checks hourly, ingests when cache is stale (2 days)
    - ECB loop: checks hourly, always ingests

    Each loop uses the pipeline's own HTTP client (no per-request clients).

    Runs forever — cancelled by the Litestar lifespan shutdown signal.
    The *settings* parameter is accepted for backwards compatibility
    but no longer used (cadence logic is self-contained).
    """

    async def _eu_loop() -> None:
        """EU ingestion loop — fires on Sunday only if cache is stale.

        The fuel APIs publish their weekly snapshot on Sundays; ingesting
        that day captures the freshest data. Uses cache freshness to avoid
        re-ingesting repeatedly on the same Sunday after the first success.
        """
        while True:
            try:
                now = datetime.now(UTC)
                if is_sunday(now):
                    eu_window = timedelta(days=pipeline.settings.eu_cache_window_days)
                    if not freshness.is_fresh("fuel-prices-eu", eu_window):
                        ok = await pipeline.ingest_eu()
                        if ok:
                            logger.info("EU ingestion completed (Sunday)")
            except Exception:
                logger.warning("EU loop error", exc_info=True)
            await asyncio.sleep(_HOUR)

    async def _ssb_loop() -> None:
        """SSB ingestion loop — fires on new month (1st) and on the 15th.

        SSB publishes its monthly fuel-price table around mid-month, so we
        try again on the 15th to pick up the fresh snapshot as soon as it
        lands. ``last_ingest`` prevents re-ingesting repeatedly within the
        same day; each new month and each 15th triggers a fresh attempt.
        """
        prev_month: int | None = None
        last_ingest_date: str | None = None
        while True:
            try:
                now = datetime.now(UTC)
                current_month = now.month
                today = now.date().isoformat()
                month_changed = is_new_month(current_month, prev_month)
                publish_day = is_ssb_publish_day(now)
                if (month_changed or publish_day) and last_ingest_date != today:
                    ok = await pipeline.ingest_ssb()
                    if ok:
                        prev_month = current_month
                        last_ingest_date = today
                        trigger = "new month" if month_changed else "publish day (15th)"
                        logger.info("SSB ingestion completed (%s)", trigger)
            except Exception:
                logger.warning("SSB loop error", exc_info=True)
            await asyncio.sleep(_HOUR)

    async def _iceland_loop() -> None:
        """Iceland loop — ingests when the cache is stale (2-day window).

        Gasvaktin publishes per-station prices that change frequently, but
        the national average is stable enough that a 2-day freshness window
        keeps the data current without hammering the upstream.
        """
        while True:
            try:
                iceland_window = timedelta(days=2)
                if not freshness.is_fresh("iceland-is", iceland_window):
                    ok = await pipeline.ingest_is()
                    if ok:
                        logger.info("Iceland ingestion completed")
            except Exception:
                logger.warning("Iceland loop error", exc_info=True)
            await asyncio.sleep(_HOUR)

    async def _ecb_loop() -> None:
        """ECB rates loop — fires on every tick (daily cadence)."""
        while True:
            try:
                await pipeline.ingest_ecb()
            except Exception:
                logger.warning("ECB loop error", exc_info=True)
            await asyncio.sleep(_HOUR)

    await asyncio.gather(_eu_loop(), _ssb_loop(), _iceland_loop(), _ecb_loop())
