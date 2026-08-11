"""Cache-first price query service — resolves country prices.

Implements the resolve(country) flow:
  1. Check cache → fresh? → X-Cache: HIT
  2. Stale? → try ingest → ok? → X-Cache: REFRESHED | fail? → X-Cache: STALE
  3. Miss? → try ingest → ok? → X-Cache: REFRESHED | fail? → CacheMissError

Reads from per-country index files (written by CacheStore) for O(1)
lookup instead of O(n) scan + filter. Falls back to full-file read + filter
if the index is missing.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING

import httpx

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from models.countries import COUNTRY_SOURCE as _COUNTRY_SOURCE
from models.countries import SOURCE_WINDOW_DAYS as _SOURCE_WINDOW_DAYS
from models.errors import CacheMissError
from models.price import Country, PriceRecord, PriceResponse

if TYPE_CHECKING:
    from services.ingestion_pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

# Country → cache source key and source → freshness window attribute.
# Generated from countries.json — see scripts/generate_countries.py.
# Iceland uses a short window (2 days) — station prices change often.


class PriceQueryService:
    """Cache-first price resolution for a given country.

    Depends on CacheStore + CacheFreshness for data access and
    IngestionPipeline for on-demand refresh during stale/miss resolution.
    """

    def __init__(
        self,
        store: CacheStore,
        freshness: CacheFreshness,
        pipeline: IngestionPipeline,
    ) -> None:
        self.store = store
        self.freshness = freshness
        self.pipeline = pipeline
        self._settings = pipeline.settings  # for window config

    # ── Public resolve ────────────────────────────────────────────────────

    async def resolve(
        self, country: Country, client: httpx.AsyncClient | None = None,
    ) -> tuple[PriceResponse, str]:
        """Resolve prices for *country*, returning (PriceResponse, cache_status).

        cache_status is one of ``"HIT"``, ``"STALE"``, or ``"REFRESHED"``.
        Raises CacheMissError on cold start when all upstreams are down.
        """
        source = _COUNTRY_SOURCE[country]
        window_days = getattr(self._settings, _SOURCE_WINDOW_DAYS[source])
        window = timedelta(days=window_days)

        cache_exists = self.store.exists(source)

        if cache_exists and self.freshness.is_fresh(source, window):
            # ── Fresh hit — read from country index ──────────────────────
            filtered = self._read_country(source, country)
            return PriceResponse(country=country, prices=filtered), "HIT"

        # ── Stale or miss — attempt refresh ────────────────────────────
        refreshed_sources = await self.pipeline.refresh(client)

        if source in refreshed_sources:
            filtered = self._read_country(source, country)
            return PriceResponse(country=country, prices=filtered), "REFRESHED"

        if cache_exists:
            # Stale fallback
            filtered = self._read_country(source, country)
            return PriceResponse(country=country, prices=filtered), "STALE"

        raise CacheMissError(
            "Price data not yet available. Try again later.",
            code="SERVICE_UNAVAILABLE",
        )

    # ── Internal ──────────────────────────────────────────────────────────

    def _read_country(
        self, source: str, country: Country,
    ) -> list[PriceRecord]:
        """Read records for *country*, preferring the country index.

        Tries the index file first (``{source}_idx_{country}.json``) for
        O(1) lookup. Falls back to reading the full file and filtering.

        Returns records sorted by date descending (most recent first).
        """
        idx_source = f"{source}_idx_{country.value}"

        # Try index file first (fast path)
        try:
            records = self.store.read(idx_source)
        except CacheMissError:
            # Fallback: read full file and filter
            all_records = self.store.read(source)
            records = [r for r in all_records if r.country == country]

        records.sort(key=lambda r: r.date, reverse=True)
        return records
