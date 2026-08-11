"""Tests for ingestion/ssb.py — fetch and parse SSB JSON-stat table 09654.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN → TRIANGULATE → REFACTOR).

Covers spec scenarios:
  - Successful SSB fetch → NO records with price_native in NOK
  - SSB returns error → error logged, no NO records
  - SSB JSON-stat structure changes → ParseError (typed, never silent)
"""

from datetime import date
from decimal import Decimal

import httpx
import pytest
import respx

from ingestion.ssb import fetch_and_parse, parse_jsonstat_response  # noqa: E402 — RED
from models.errors import ParseError, UpstreamError

# ── Realistic mock JSON-stat2 response for SSB table 09654 ────────────────
# 3 dimensions: PetroleumProd (2 fuels) × ContentsCode (always "Priser") × Tid (3 months)
# Values are flattened in dimension order.
_SSB_JSONSTAT = {
    "version": "2.0",
    "class": "dataset",
    "id": ["PetroleumProd", "ContentsCode", "Tid"],
    "size": [2, 1, 3],
    "dimension": {
        "PetroleumProd": {
            "label": "petroleum products",
            "category": {
                "index": {
                    "031": 0,
                    "035": 1,
                },
                "label": {
                    "031": "Motor gasoline, leadfree 95 octan",
                    "035": "Dutiable diesel",
                },
            },
        },
        "ContentsCode": {
            "label": "contents",
            "category": {
                "index": {"Priser": 0},
                "label": {"Priser": "Prices (NOK per litres)"},
            },
        },
        "Tid": {
            "label": "month",
            "category": {
                "index": {"2026M03": 0, "2026M04": 1, "2026M05": 2},
            },
        },
    },
    # values[0..2]: Euro 95 (M03=21.50, M04=21.65, M05=21.80) × 1 ContentsCode
    # values[3..5]: Diesel   (M03=19.80, M04=19.95, M05=20.10) × 1 ContentsCode
    "value": [21.50, 21.65, 21.80, 19.80, 19.95, 20.10],
}


# ── Successful parse ──────────────────────────────────────────────────────


def test_parse_valid_jsonstat_returns_six_records():
    """GIVEN valid JSON-stat for NO WHEN parsed THEN 6 records (2 fuels × 3 months)."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    assert len(records) == 6
    for r in records:
        assert r["country"] == "NO"
        assert r["fuel"] in ("euro_95", "diesel")


def test_parse_extracts_all_months_with_correct_dates():
    """GIVEN JSON-stat with M03-M05 WHEN parsed THEN dates are YYYY-MM-01."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    dates = {r["date"] for r in records}
    assert dates == {date(2026, 3, 1), date(2026, 4, 1), date(2026, 5, 1)}


def test_parse_correct_euro95_price_m05():
    """GIVEN JSON-stat with known values WHEN parsed THEN correct price_nok for Euro 95 M05."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    may_euro95 = next(
        r
        for r in records
        if r["fuel"] == "euro_95" and r["date"] == date(2026, 5, 1)
    )
    assert may_euro95["price_nok"] == Decimal("21.80")


def test_parse_correct_diesel_price_m05():
    """GIVEN JSON-stat with known values WHEN parsed THEN correct price_nok for Diesel M05."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    may_diesel = next(
        r
        for r in records
        if r["fuel"] == "diesel" and r["date"] == date(2026, 5, 1)
    )
    assert may_diesel["price_nok"] == Decimal("20.10")


def test_parse_nok_prices_are_decimal():
    """GIVEN valid JSON-stat WHEN parsed THEN all price_nok values are positive Decimal."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    for r in records:
        assert isinstance(r["price_nok"], Decimal)
        assert r["price_nok"] > 0


def test_parse_all_records_have_no_country():
    """GIVEN valid JSON-stat WHEN parsed THEN every record has country='NO'."""
    records = parse_jsonstat_response(_SSB_JSONSTAT)

    countries = {r["country"] for r in records}
    assert countries == {"NO"}


# ── Schema drift (spec: "must fail with typed error") ────────────────────


def test_parse_jsonstat_schema_drift_missing_petroleum_prod():
    """GIVEN response without PetroleumProd dimension WHEN parsed THEN ParseError."""
    bad = {
        "version": "2.0",
        "class": "dataset",
        "id": ["Something", "ContentsCode", "Tid"],
        "size": [1, 1, 1],
        "dimension": {"Something": {}, "ContentsCode": {}, "Tid": {}},
        "value": [1.0],
    }

    with pytest.raises(ParseError):
        parse_jsonstat_response(bad)


def test_parse_jsonstat_schema_drift_missing_tid():
    """GIVEN response without Tid dimension WHEN parsed THEN ParseError."""
    bad = {
        "version": "2.0",
        "class": "dataset",
        "id": ["ContentsCode", "Something"],
        "size": [1, 1],
        "dimension": {"ContentsCode": {}, "Something": {}},
        "value": [1.0],
    }

    with pytest.raises(ParseError):
        parse_jsonstat_response(bad)


def test_parse_jsonstat_missing_category_index():
    """GIVEN response with PetroleumProd dim but no category/index WHEN parsed THEN ParseError."""
    bad = {
        "version": "2.0",
        "class": "dataset",
        "id": ["PetroleumProd", "ContentsCode", "Tid"],
        "size": [1, 1, 1],
        "dimension": {
            "PetroleumProd": {"label": "fuel", "category": {}},  # no index
            "ContentsCode": {"label": "contents", "category": {"index": {"Priser": 0}}},
            "Tid": {"label": "month", "category": {"index": {"2026M01": 0}}},
        },
        "value": [1.0],
    }

    with pytest.raises(ParseError):
        parse_jsonstat_response(bad)


# ── HTTP errors ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_raises_upstream_error_on_connection_refused():
    """GIVEN SSB API host is unreachable WHEN fetch_and_parse runs THEN UpstreamError."""
    async with httpx.AsyncClient() as client:
        with pytest.raises(UpstreamError):
            await fetch_and_parse(client, url="http://localhost:9999/nonexistent")


@pytest.mark.asyncio
async def test_fetch_raises_upstream_error_on_non_200(respx_mock: respx.MockRouter):
    """GIVEN SSB returns HTTP 500 WHEN fetch_and_parse runs THEN UpstreamError."""
    respx_mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(500)

    async with httpx.AsyncClient() as client:
        with pytest.raises(UpstreamError):
            await fetch_and_parse(
                client, url="https://data.ssb.no/api/v0/en/table/09654"
            )


# ── Full fetch+parse integration ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_and_parse_returns_parsed_records(
    respx_mock: respx.MockRouter,
):
    """GIVEN SSB returns valid JSON-stat WHEN fetch_and_parse runs THEN list of dicts."""
    respx_mock.post("https://data.ssb.no/api/v0/en/table/09654").respond(
        200, json=_SSB_JSONSTAT
    )

    async with httpx.AsyncClient() as client:
        records = await fetch_and_parse(
            client, url="https://data.ssb.no/api/v0/en/table/09654"
        )

    assert len(records) == 6
    assert all(r["country"] == "NO" for r in records)
    assert any(r["fuel"] == "euro_95" for r in records)
    assert any(r["fuel"] == "diesel" for r in records)
