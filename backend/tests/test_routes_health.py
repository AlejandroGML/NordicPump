"""Tests for routes/health.py — GET /health endpoint.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN).
"""

import re
from datetime import UTC, datetime

import pytest
from litestar import Litestar
from litestar.testing import AsyncTestClient

# ═══════════════════════════════════════════════════════════════════════════════
# RED: Importing code that does NOT exist yet
# ═══════════════════════════════════════════════════════════════════════════════
from routes.health import health_router  # noqa: E402 — does NOT exist yet (RED)

# ═══════════════════════════════════════════════════════════════════════════════
# 5.3.a — GET /health returns 200 + status ok + ISO-8601 timestamp
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_health_returns_200_with_status_ok():
    """GIVEN the service is running WHEN GET /health THEN 200 + ok + timestamp.

    Spec: prices-api → Service healthy.
    """
    app = Litestar(route_handlers=[health_router])

    async with AsyncTestClient(app) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "timestamp" in body

    # Verify ISO-8601 format: 2026-06-27T...
    iso_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
    assert re.match(iso_pattern, body["timestamp"]), (
        f"Expected ISO-8601 timestamp, got: {body['timestamp']!r}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5.3.b — Timestamp is current (within last few seconds)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_health_timestamp_is_recent():
    """GIVEN the service is running WHEN GET /health THEN timestamp is current.

    Triangulation: ensures the timestamp isn't hardcoded.
    """
    app = Litestar(route_handlers=[health_router])

    async with AsyncTestClient(app) as client:
        response = await client.get("/health")

    body = response.json()
    ts = datetime.fromisoformat(body["timestamp"])
    now = datetime.now(UTC)
    delta = abs((now - ts).total_seconds())
    assert delta < 10, f"Timestamp is {delta}s old, expected < 10s"
