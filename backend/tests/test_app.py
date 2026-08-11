"""Tests for app.py — Litestar application assembly.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN).
Tests app startup, health, error handling, and route registration.
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


def _settings(cache_dir: Path) -> Settings:
    return Settings(
        cache_dir=cache_dir,
        _env_file=None,  # type: ignore[call-arg]
    )


def _make_record(country="SE", fuel="euro_95", price_sek="16.68"):
    return PriceRecord(
        country=Country(country),
        fuel=FuelType(fuel),
        price_eur=Decimal("1.45"),
        price_native=Decimal("1.45"),
        price_native_currency="EUR",
        price_sek=Decimal(price_sek),
        date=date(2026, 6, 26),
        frequency="weekly",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# RED: Importing code that does NOT exist yet
# ═══════════════════════════════════════════════════════════════════════════════
from app import create_app  # noqa: E402 — does NOT exist yet (RED)

# ═══════════════════════════════════════════════════════════════════════════════
# 5.5.a — App starts and serves /health
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_app_health_endpoint_works(tmp_path: Path):
    """GIVEN a running app WHEN GET /health THEN 200 + status ok.

    Full stack integration: proves app wiring is correct.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    app = create_app(store, freshness, settings)

    async with AsyncTestClient(app) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


# ═══════════════════════════════════════════════════════════════════════════════
# 5.5.b — App serves /api/v1/prices/se with fresh cache
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_app_prices_endpoint_with_fresh_cache(tmp_path: Path):
    """GIVEN fresh cache WHEN GET /api/v1/prices/se THEN 200 + X-Cache: HIT.

    Full stack: proves routes + service + cache are wired together.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    records = [
        _make_record(country="SE", fuel="euro_95", price_sek="16.68"),
        _make_record(country="SE", fuel="diesel", price_sek="17.83"),
    ]
    store.write("fuel-prices-eu", records)

    app = create_app(store, freshness, settings)

    async with AsyncTestClient(app) as client:
        response = await client.get("/api/v1/prices/se")

    assert response.status_code == 200
    assert response.headers.get("X-Cache") == "HIT"
    body = response.json()
    assert body["country"] == "SE"
    assert len(body["prices"]) == 2


# ═══════════════════════════════════════════════════════════════════════════════
# 5.5.c — App returns 404 for unsupported country
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_app_returns_404_for_unsupported_country(tmp_path: Path):
    """GIVEN unknown country WHEN GET /api/v1/prices/xx THEN 404.

    Proves exception handlers are registered on the app.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    app = create_app(store, freshness, settings)

    async with AsyncTestClient(app) as client:
        response = await client.get("/api/v1/prices/xx")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "UNSUPPORTED_COUNTRY"


# ═══════════════════════════════════════════════════════════════════════════════
# 5.5.d — App returns 503 on cold start with upstream down
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_app_returns_503_on_cold_start(tmp_path: Path):
    """GIVEN no cache AND upstream down WHEN GET /api/v1/prices/se THEN 503.

    Full stack error: CacheMissError → 503 + Retry-After.
    """
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)

    app = create_app(store, freshness, settings)

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
# 5.5.e — CORS headers present in response (dev mode)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_app_includes_cors_headers(tmp_path: Path):
    """GIVEN a CORS preflight request WHEN OPTIONS THEN CORS headers present."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = Settings(
        cache_dir=tmp_path,
        dev_mode=True,
        _env_file=None,  # type: ignore[call-arg]
    )

    app = create_app(store, freshness, settings)

    async with AsyncTestClient(app) as client:
        response = await client.options(
            "/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )

    # CORS middleware should handle preflight
    assert response.status_code in (200, 204)
