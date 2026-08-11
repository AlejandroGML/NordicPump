"""Tests for routes/prices.py — GET /api/v1/prices/{country}.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN).
Uses Litestar TestClient for HTTP-level integration tests.
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
import respx
from litestar.testing import AsyncTestClient

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from models.price import Country, FuelType, PriceRecord

# ═══════════════════════════════════════════════════════════════════════════════
# RED: Importing code that does NOT exist yet
# ═══════════════════════════════════════════════════════════════════════════════
from routes.prices import create_prices_router  # noqa: E402 — does NOT exist yet (RED)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_record(
    country: str = "SE",
    fuel: str = "euro_95",
    price_eur: str = "1.45",
    price_native: str = "1.45",
    price_native_currency: str = "EUR",
    price_sek: str = "16.68",
    record_date: date | None = None,
    frequency: str = "weekly",
) -> PriceRecord:
    return PriceRecord(
        country=Country(country),
        fuel=FuelType(fuel),
        price_eur=Decimal(price_eur),
        price_native=Decimal(price_native),
        price_native_currency=price_native_currency,
        price_sek=Decimal(price_sek),
        date=record_date or date(2026, 6, 26),
        frequency=frequency,
    )


def _settings(cache_dir: Path) -> Settings:
    return Settings(
        cache_dir=cache_dir,
        _env_file=None,  # type: ignore[call-arg]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5.2.a — GET /api/v1/prices/se with fresh cache → 200 + X-Cache: HIT
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_prices_se_returns_200_with_x_cache_hit(tmp_path: Path):
    """GIVEN fresh cache WHEN GET /api/v1/prices/se THEN 200 + X-Cache: HIT.

    Spec: prices-api → Swedish prices returned.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    records = [
        _make_record(country="SE", fuel="euro_95", price_sek="16.68"),
        _make_record(country="SE", fuel="diesel", price_sek="17.83"),
    ]
    store.write("fuel-prices-eu", records)

    from services.ingestion_pipeline import IngestionPipeline
    from services.price_query import PriceQueryService
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    from litestar import Litestar
    router = create_prices_router(service, settings)
    app = Litestar(route_handlers=[router])

    async with AsyncTestClient(app) as client:
        response = await client.get("/api/v1/prices/se")

    assert response.status_code == 200
    assert response.headers.get("X-Cache") == "HIT"
    body = response.json()
    assert body["country"] == "SE"
    assert len(body["prices"]) == 2
    assert body["prices"][0]["fuel"] == "euro_95"
    assert body["prices"][0]["price_sek"] == "16.68"  # JSON: Decimal → string (precision preserved)


# ═══════════════════════════════════════════════════════════════════════════════
# 5.2.b — GET /api/v1/prices/xx → 404 UNSUPPORTED_COUNTRY
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_prices_unknown_country_returns_404(tmp_path: Path):
    """GIVEN unsupported country WHEN GET /api/v1/prices/xx THEN 404.

    Spec: prices-api → Unsupported country code.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    from services.ingestion_pipeline import IngestionPipeline
    from services.price_query import PriceQueryService
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    from litestar import Litestar
    router = create_prices_router(service, settings)
    app = Litestar(route_handlers=[router])

    async with AsyncTestClient(app) as client:
        response = await client.get("/api/v1/prices/xx")

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "UNSUPPORTED_COUNTRY"
    assert "xx" in body["error"]["message"].lower() or "XX" in body["error"]["message"]


# ═══════════════════════════════════════════════════════════════════════════════
# 5.2.c — GET /api/v1/prices/se with cold start + upstream down → 503
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_prices_cold_start_upstream_down_returns_503(tmp_path: Path):
    """GIVEN no cache AND upstream unreachable WHEN GET THEN 503 + Retry-After.

    Spec: prices-api → Cold start — no cache and upstream down.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    from services.ingestion_pipeline import IngestionPipeline
    from services.price_query import PriceQueryService
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    from litestar import Litestar
    router = create_prices_router(service, settings)
    app = Litestar(route_handlers=[router])

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with AsyncTestClient(app) as client:
            response = await client.get("/api/v1/prices/se")

    assert response.status_code == 503
    assert response.headers.get("Retry-After") == "300"
    body = response.json()
    assert body["error"]["code"] == "SERVICE_UNAVAILABLE"


# ═══════════════════════════════════════════════════════════════════════════════
# 5.2.d — GET /api/v1/prices/dk with stale cache → 200 + X-Cache: STALE
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_prices_returns_stale_when_upstream_down(tmp_path: Path):
    """GIVEN stale cache WHEN upstream fails THEN 200 + X-Cache: STALE."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    record = _make_record(country="DK", fuel="euro_95", price_eur="1.52", price_sek="17.48")
    import json as _json
    old_data = {
        "cached_at": "2026-01-01T00:00:00",
        "records": [record.model_dump(mode="json")],
    }
    (tmp_path / "fuel-prices-eu.json").write_text(_json.dumps(old_data, default=str))

    from services.ingestion_pipeline import IngestionPipeline
    from services.price_query import PriceQueryService
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)
    service = PriceQueryService(store=store, freshness=freshness, pipeline=pipeline)

    from litestar import Litestar
    router = create_prices_router(service, settings)
    app = Litestar(route_handlers=[router])

    with respx.mock as mock:
        mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)
        mock.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml").respond(500)

        async with AsyncTestClient(app) as client:
            response = await client.get("/api/v1/prices/dk")

    assert response.status_code == 200
    assert response.headers.get("X-Cache") == "STALE"
    body = response.json()
    assert body["country"] == "DK"
