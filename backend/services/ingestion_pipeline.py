"""Ingestion pipeline — fetches, normalizes, and writes upstream price data.

Handles all upstream data sources:
  - EU fuel prices (fuel-prices.eu) — weekly cadence
  - SSB Norway prices (Statistics Norway) — monthly cadence
  - ECB reference rates — daily cadence

Each ingestion method is independent — a failure in one does not block
the others. ECB rates are cached on the instance to avoid re-fetching
when both EU and SSB ingestion run in the same tick.
"""

from __future__ import annotations

import logging
from decimal import Decimal

import httpx

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from ingestion import ecb_rates, fuel_prices_eu, iceland, ssb
from ingestion.normalizer import normalize
from models.errors import CacheMissError
from models.price import PriceRecord

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """Fetches upstream data, normalizes it, and writes to cache.

    Composable: can be used standalone (by scheduler) or wired into
    ``PriceQueryService`` for on-demand refresh during resolution.
    """

    def __init__(self, store: CacheStore, freshness: CacheFreshness, settings: Settings) -> None:
        self.store = store
        self.freshness = freshness
        self.settings = settings
        self._cached_ecb_rates: dict[str, Decimal] | None = None
        self._client = httpx.AsyncClient()

    async def close(self) -> None:
        """Close the internal HTTP client."""
        await self._client.aclose()

    # ── Public ingestion (called by scheduler) ───────────────────────────

    async def ingest_eu(self, client: httpx.AsyncClient | None = None) -> bool:
        """Fetch EU fuel prices, normalize, and write to cache.

        Returns True if ingestion succeeded, False on any failure.
        """
        http = client or self._client
        try:
            rates = await self._fetch_rates(http)
            eu_raw = await fuel_prices_eu.fetch_and_parse(
                http, self.settings.fuel_prices_eu_url,
            )
            eu_records = normalize(
                eu_raw,
                eur_sek=rates["EUR_SEK"],
                eur_dkk=rates["EUR_DKK"],
            )
            merged = self._merge_with_cache("fuel-prices-eu", eu_records)
            self.store.write("fuel-prices-eu", merged)
            return True
        except Exception:
            logger.warning("EU ingestion failed", exc_info=True)
            return False

    async def ingest_ssb(self, client: httpx.AsyncClient | None = None) -> bool:
        """Fetch SSB Norwegian prices, normalize, and write to cache.

        Returns True if ingestion succeeded, False on any failure.
        """
        http = client or self._client
        try:
            rates = await self._fetch_rates(http)
            ssb_raw = await ssb.fetch_and_parse(
                http, self.settings.ssb_api_url,
            )
            no_records = normalize(
                ssb_raw,
                eur_sek=rates["EUR_SEK"],
                eur_dkk=rates["EUR_DKK"],
                eur_nok=rates["EUR_NOK"],
            )
            merged = self._merge_with_cache("ssb-no", no_records)
            self.store.write("ssb-no", merged)
            return True
        except Exception:
            logger.warning("SSB ingestion failed", exc_info=True)
            return False

    async def ingest_is(self, client: httpx.AsyncClient | None = None) -> bool:
        """Fetch Icelandic fuel prices (gasvaktin), normalize, and write to cache.

        EUR→ISK comes from a public rates API (ECB has no ISK) with the
        configured fallback when it fails. Returns True on success.
        """
        http = client or self._client
        try:
            try:
                eur_isk = await iceland.fetch_eur_isk_rate(http)
            except Exception:
                logger.warning("EUR→ISK rate fetch failed, using fallback")
                eur_isk = self.settings.eur_isk_fallback

            is_raw = await iceland.fetch_and_parse(http)
            # ISK is already native; the SEK/DKK/NOK rates only matter for
            # the cross-currency fields (price_sek) — reuse ECB rates when
            # available, else the configured fallbacks.
            try:
                rates = await self._fetch_rates(http)
                eur_sek = rates["EUR_SEK"]
                eur_dkk = rates["EUR_DKK"]
                eur_nok = rates["EUR_NOK"]
            except Exception:
                eur_sek = self.settings.eur_sek_fallback
                eur_dkk = self.settings.eur_dkk_fallback
                eur_nok = self.settings.eur_nok_fallback
            is_records = normalize(
                is_raw,
                eur_sek=eur_sek,
                eur_dkk=eur_dkk,
                eur_nok=eur_nok,
                eur_isk=eur_isk,
            )
            merged = self._merge_with_cache("iceland-is", is_records)
            self.store.write("iceland-is", merged)
            return True
        except Exception:
            logger.warning("Iceland ingestion failed", exc_info=True)
            return False

    async def ingest_ecb(self, client: httpx.AsyncClient | None = None) -> bool:
        """Fetch ECB reference rates (daily cadence).

        Parses and caches the rates on ``self._cached_ecb_rates`` so that
        ``_fetch_rates()`` can reuse them instead of re-fetching.

        Returns True if ECB API returned fresh rates, False on failure
        (network error, bad status, or unparseable XML). On False,
        ``_fetch_rates()`` will use config fallback for EU/SSB ingestion.
        """
        http = client or self._client
        try:
            response = await http.get(
                self.settings.ecb_api_url, follow_redirects=True,
            )
            response.raise_for_status()
            self._cached_ecb_rates = ecb_rates.parse_ecb_xml(response.text)
            return True
        except Exception:
            logger.warning("ECB daily rates fetch failed", exc_info=True)
            self._cached_ecb_rates = None
            return False

    # ── Internal ──────────────────────────────────────────────────────────

    async def refresh(self, client: httpx.AsyncClient | None = None) -> set[str]:
        """Attempt to refresh all sources, returning successfully ingested keys.

        Public entry point for on-demand refresh (e.g. from PriceQueryService
        on stale/miss). Falls back to the pipeline's own client when *client*
        is None. Never raises — returns an empty set when all sources fail.
        """
        http = client or self._client
        try:
            return await self._ingest_all(http)
        except Exception:
            logger.warning("Ingestion refresh failed", exc_info=True)
            return set()

    async def _ingest_all(self, client: httpx.AsyncClient) -> set[str]:
        """Fetch all upstream sources, normalize, and write to cache.

        Each source is independent — a failure in one does not block the
        others. Returns set of source keys that were successfully ingested.
        """
        success: set[str] = set()

        if await self.ingest_eu(client):
            success.add("fuel-prices-eu")
        if await self.ingest_ssb(client):
            success.add("ssb-no")

        return success

    async def get_rates(self) -> dict[str, Decimal]:
        """Return current EUR→SEK/DKK/NOK rates, fetching fresh if not cached.

        Public entry point for the /api/v1/rates endpoint. Reuses the
        ECB rates cached by ingestion; falls back to config fallbacks
        when ECB is unreachable (same policy as ingestion).
        """
        if self._cached_ecb_rates is not None:
            return self._cached_ecb_rates
        return await self._fetch_rates(self._client)

    def _merge_with_cache(
        self, source: str, new_records: list[PriceRecord],
    ) -> list[PriceRecord]:
        """Merge *new_records* into the existing cache, keeping history.

        Accumulates weekly/monthly snapshots: records for the same
        (country, fuel, date) are deduped; records for NEW dates are
        appended so the historical series grows over time. This is what
        makes the price-history chart show a real trend instead of a
        single point.

        Falls back to just *new_records* when the cache is missing.
        """
        try:
            existing = self.store.read(source)
        except CacheMissError:
            return new_records

        existing_keys = {(r.country, r.fuel, r.date) for r in existing}
        merged = list(existing)
        for record in new_records:
            key = (record.country, record.fuel, record.date)
            if key not in existing_keys:
                merged.append(record)
                existing_keys.add(key)
        return merged

    async def _fetch_rates(self, client: httpx.AsyncClient) -> dict[str, Decimal]:
        """Fetch ECB rates or return configured fallback on failure.

        If ``ingest_ecb()`` has already cached rates, returns those instead
        of making a second HTTP request. Never raises — returns fallback
        rates when ECB is unreachable.
        """
        if self._cached_ecb_rates is not None:
            return self._cached_ecb_rates
        try:
            rates = await ecb_rates.fetch_rates(
                client, self.settings.ecb_api_url,
            )
            self._cached_ecb_rates = rates
            return rates
        except Exception:
            logger.warning("ECB rates fetch failed, using fallback")
            self._cached_ecb_rates = None
            return {
                "EUR_SEK": self.settings.eur_sek_fallback,
                "EUR_DKK": self.settings.eur_dkk_fallback,
                "EUR_NOK": self.settings.eur_nok_fallback,
            }
