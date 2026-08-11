"""Tests for routes/rates.py — GET /api/v1/rates.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN).
Uses Litestar TestClient for HTTP-level integration tests.
"""

from pathlib import Path

import pytest
from litestar import Litestar
from litestar.testing import AsyncTestClient

from cache.cache_freshness import CacheFreshness
from cache.cache_store import CacheStore
from config import Settings
from routes.rates import create_rates_router
from services.ingestion_pipeline import IngestionPipeline


def _settings(cache_dir: Path) -> Settings:
    return Settings(
        cache_dir=cache_dir,
        _env_file=None,  # type: ignore[call-arg]
    )


@pytest.mark.asyncio
async def test_get_rates_returns_eur_base_with_nordic_currencies(tmp_path: Path):
    """GIVEN a wired pipeline WHEN GET /api/v1/rates THEN EUR base + SEK/DKK/NOK."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    router = create_rates_router(pipeline)
    app = Litestar(route_handlers=[router])

    async with AsyncTestClient(app) as client:
        response = await client.get("/api/v1/rates")
        await pipeline.close()

    assert response.status_code == 200
    body = response.json()
    assert body["base"] == "EUR"
    rates = body["rates"]
    assert set(rates.keys()) == {"SEK", "DKK", "NOK"}
    for value in rates.values():
        assert isinstance(value, float)
        assert value > 0


@pytest.mark.asyncio
async def test_get_rates_uses_config_fallback_when_ecb_down(tmp_path: Path):
    """GIVEN ECB unreachable WHEN GET /api/v1/rates THEN config fallbacks served."""
    store = CacheStore(tmp_path)
    freshness = CacheFreshness(tmp_path)
    settings = _settings(tmp_path)
    pipeline = IngestionPipeline(store=store, freshness=freshness, settings=settings)

    # Force fallback path: clear cached rates and point at an unreachable URL
    pipeline._cached_ecb_rates = None
    settings_original = pipeline.settings
    from types import SimpleNamespace
    pipeline.settings = SimpleNamespace(
        ecb_api_url="https://127.0.0.1:1/unreachable.xml",
        eur_sek_fallback=settings.eur_sek_fallback,
        eur_dkk_fallback=settings.eur_dkk_fallback,
        eur_nok_fallback=settings.eur_nok_fallback,
    )
    try:
        router = create_rates_router(pipeline)
        app = Litestar(route_handlers=[router])
        async with AsyncTestClient(app) as client:
            response = await client.get("/api/v1/rates")
    finally:
        pipeline.settings = settings_original
        await pipeline.close()

    assert response.status_code == 200
    body = response.json()
    assert body["rates"]["SEK"] == float(settings.eur_sek_fallback)
    assert body["rates"]["DKK"] == float(settings.eur_dkk_fallback)
    assert body["rates"]["NOK"] == float(settings.eur_nok_fallback)
