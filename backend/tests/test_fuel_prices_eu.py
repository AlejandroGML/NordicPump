"""Tests for ingestion/fuel_prices_eu.py — fetch and parse fuel-prices.eu llms.txt.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN → TRIANGULATE → REFACTOR).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import respx

from ingestion.fuel_prices_eu import fetch_and_parse, parse_llms_txt  # noqa: E402 — RED
from models.errors import ParseError, UpstreamError

FIXTURES = Path(__file__).parent / "fixtures"


def _read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# ── Successful parse (real fixture) ────────────────────────────────────────


def test_parse_valid_llms_txt_returns_six_records():
    """GIVEN a valid llms.txt fixture WHEN parsed THEN 6 records (SE/DK/FI × 2 fuels)."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    assert len(records) == 6
    countries = {r["country"] for r in records}
    assert countries == {"SE", "DK", "FI"}


def test_parse_extracts_correct_prices_for_sweden():
    """GIVEN llms.txt with SE row WHEN parsed THEN correct Euro 95 and Diesel prices."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    se_records = [r for r in records if r["country"] == "SE"]
    se_euro95 = next(r for r in se_records if r["fuel"] == "euro_95")
    se_diesel = next(r for r in se_records if r["fuel"] == "diesel")

    assert se_euro95["price_eur"] == Decimal("1.535")
    assert se_diesel["price_eur"] == Decimal("1.702")


def test_parse_extracts_correct_prices_for_denmark():
    """GIVEN llms.txt with DK row WHEN parsed THEN correct Euro 95 and Diesel prices."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    dk_records = [r for r in records if r["country"] == "DK"]
    dk_euro95 = next(r for r in dk_records if r["fuel"] == "euro_95")
    dk_diesel = next(r for r in dk_records if r["fuel"] == "diesel")

    assert dk_euro95["price_eur"] == Decimal("2.312")
    assert dk_diesel["price_eur"] == Decimal("1.980")


def test_parse_extracts_correct_prices_for_finland():
    """GIVEN llms.txt with FI row WHEN parsed THEN correct Euro 95 and Diesel prices."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    fi_records = [r for r in records if r["country"] == "FI"]
    fi_euro95 = next(r for r in fi_records if r["fuel"] == "euro_95")
    fi_diesel = next(r for r in fi_records if r["fuel"] == "diesel")

    assert fi_euro95["price_eur"] == Decimal("2.152")
    assert fi_diesel["price_eur"] == Decimal("2.173")


def test_parse_extracts_date_from_last_updated_header():
    """GIVEN llms.txt with 'Last updated:' header WHEN parsed THEN date is extracted."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    for r in records:
        assert r["date"] == date(2026, 6, 22)


def test_parse_ignores_non_nordic_countries():
    """GIVEN llms.txt with all 27 EU countries WHEN parsed THEN only SE/DK/FI returned."""
    text = _read_fixture("llms.txt")

    records = parse_llms_txt(text)

    countries = {r["country"] for r in records}
    assert countries == {"SE", "DK", "FI"}
    # Verify Germany (DE) is NOT in results
    assert "DE" not in countries
    assert "PL" not in countries


# ── Error cases ───────────────────────────────────────────────────────────


def test_parse_raises_parse_error_on_malformed_input():
    """GIVEN garbage text WHEN parsed THEN ParseError is raised."""
    with pytest.raises(ParseError):
        parse_llms_txt("completely invalid garbage text\nno table here")


def test_parse_raises_parse_error_on_missing_table():
    """GIVEN text with no data rows WHEN parsed THEN ParseError is raised."""
    with pytest.raises(ParseError):
        parse_llms_txt("Last updated: 2026-06-22\n\nNo table.\n")


def test_parse_handles_missing_last_updated_header():
    """GIVEN llms.txt without 'Last updated:' WHEN parsed THEN date is None per record."""
    text = (
        "## Current Fuel Prices\n\n"
        "CC   Country                  Euro95/L   Diesel/L\n"
        "----------------------------------------------------------------\n"
        "SE   Sweden                 €   1.535 €   1.702\n"
    )

    records = parse_llms_txt(text)

    for r in records:
        assert r["date"] is None


@pytest.mark.asyncio
async def test_fetch_raises_upstream_error_on_http_failure():
    """GIVEN fuel-prices.eu is unreachable WHEN fetch_and_parse runs THEN UpstreamError."""
    async with httpx.AsyncClient() as client:
        with pytest.raises(UpstreamError):
            # Point to a non-existent host to trigger connection error
            await fetch_and_parse(client, url="http://localhost:9999/nonexistent")


@pytest.mark.asyncio
async def test_fetch_raises_upstream_error_on_non_200(respx_mock: respx.MockRouter):
    """GIVEN fuel-prices.eu returns 500 WHEN fetch_and_parse runs THEN UpstreamError."""
    respx_mock.get("https://www.fuel-prices.eu/llms.txt").respond(500)

    async with httpx.AsyncClient() as client:
        with pytest.raises(UpstreamError):
            await fetch_and_parse(
                client, url="https://www.fuel-prices.eu/llms.txt"
            )


@pytest.mark.asyncio
async def test_fetch_and_parse_returns_parsed_records(respx_mock: respx.MockRouter):
    """GIVEN a successful HTTP response WHEN fetch_and_parse runs THEN records returned."""
    fixture_text = _read_fixture("llms.txt")
    respx_mock.get("https://www.fuel-prices.eu/llms.txt").respond(
        200, text=fixture_text
    )

    async with httpx.AsyncClient() as client:
        records = await fetch_and_parse(
            client, url="https://www.fuel-prices.eu/llms.txt"
        )

    assert len(records) == 6
    assert records[0]["country"] in ("SE", "DK", "FI")


# ── TRIANGULATE: edge cases ───────────────────────────────────────────────


def test_parse_handles_table_with_extra_whitespace():
    """GIVEN llms.txt with irregular whitespace WHEN parsed THEN prices still extracted."""
    # Simulate extra spaces in the table
    text = """Last updated: 2026-06-22
## Current Fuel Prices

CC   Country                  Euro95/L   Diesel/L
----------------------------------------------------------------
SE   Sweden                 €    1.535   €    1.702
DK   Denmark                €    2.312   €    1.980
"""

    records = parse_llms_txt(text)

    assert len(records) == 4  # 2 countries × 2 fuels
    se_95 = next(r for r in records if r["country"] == "SE" and r["fuel"] == "euro_95")
    assert se_95["price_eur"] == Decimal("1.535")


def test_parse_handles_negative_percentage_in_table():
    """GIVEN llms.txt with negative percentages (real format) WHEN parsed THEN still works.

    The real format has '-11.2%' after the Diesel price. The parser must stop
    after the second € value and not be confused by the negative sign.
    """
    text = _read_fixture("llms.txt")
    records = parse_llms_txt(text)

    # SE row in fixture: -11.2% after diesel — verify it was parsed correctly
    se_diesel = next(
        r for r in records if r["country"] == "SE" and r["fuel"] == "diesel"
    )
    assert se_diesel["price_eur"] == Decimal("1.702")
    # If the parser had been confused by the negative sign, the value would differ
