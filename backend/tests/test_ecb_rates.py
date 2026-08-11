"""Tests for ingestion/ecb_rates.py — fetch and parse ECB daily reference rates.

Follows strict TDD: tests written BEFORE implementation (RED → GREEN → TRIANGULATE → REFACTOR).

Covers spec scenarios:
  - Successful ECB fetch → EUR→SEK/DKK/NOK rates
  - ECB unreachable → config fallback rates
  - ECB XML structure changes → ParseError (typed, never silent)
"""

from decimal import Decimal

import httpx
import pytest
import respx

from ingestion.ecb_rates import fetch_rates, parse_ecb_xml  # noqa: E402 — RED
from models.errors import ParseError

# ── Realistic mock ECB daily reference XML ────────────────────────────────

_ECB_XML = """<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<gesmes:subject>Reference rates</gesmes:subject>
<gesmes:Sender>
<gesmes:name>European Central Bank</gesmes:name>
</gesmes:Sender>
<Cube>
  <Cube time="2026-06-26">
    <Cube currency="USD" rate="1.1525"/>
    <Cube currency="JPY" rate="161.24"/>
    <Cube currency="SEK" rate="11.5000"/>
    <Cube currency="DKK" rate="7.4500"/>
    <Cube currency="NOK" rate="12.0000"/>
  </Cube>
</Cube>
</gesmes:Envelope>"""

# ── Successful parse ──────────────────────────────────────────────────────


def test_parse_valid_ecb_xml_returns_correct_rates():
    """GIVEN valid ECB XML WHEN parsed THEN EUR→SEK/DKK/NOK returned as Decimal."""
    rates = parse_ecb_xml(_ECB_XML)

    assert rates == {
        "EUR_SEK": Decimal("11.5000"),
        "EUR_DKK": Decimal("7.4500"),
        "EUR_NOK": Decimal("12.0000"),
    }


def test_parse_ecb_xml_ignores_non_nordic_currencies():
    """GIVEN ECB XML with USD/JPY WHEN parsed THEN only SEK/DKK/NOK returned."""
    rates = parse_ecb_xml(_ECB_XML)

    assert len(rates) == 3
    assert "EUR_USD" not in rates
    assert "EUR_JPY" not in rates


def test_parse_ecb_xml_all_values_are_decimal():
    """GIVEN valid ECB XML WHEN parsed THEN all rates are Decimal type."""
    rates = parse_ecb_xml(_ECB_XML)

    for key, val in rates.items():
        assert isinstance(val, Decimal), f"{key} should be Decimal, got {type(val)}"


# ── Error cases ───────────────────────────────────────────────────────────


def test_parse_ecb_xml_missing_sek_rate():
    """GIVEN ECB XML without SEK rate WHEN parsed THEN ParseError (never silent)."""
    xml_no_sek = _ECB_XML.replace('currency="SEK"', 'currency="XXX"')

    with pytest.raises(ParseError):
        parse_ecb_xml(xml_no_sek)


def test_parse_ecb_xml_missing_nok_rate():
    """GIVEN ECB XML without NOK rate WHEN parsed THEN ParseError."""
    xml_no_nok = _ECB_XML.replace('currency="NOK"', 'currency="XXX"')

    with pytest.raises(ParseError):
        parse_ecb_xml(xml_no_nok)


def test_parse_malformed_xml_raises_parse_error():
    """GIVEN garbage (not XML) WHEN parsed THEN ParseError."""
    with pytest.raises(ParseError):
        parse_ecb_xml("<not>valid<xml>")


def test_parse_empty_xml_raises_parse_error():
    """GIVEN empty string WHEN parsed THEN ParseError."""
    with pytest.raises(ParseError):
        parse_ecb_xml("")

    with pytest.raises(ParseError):
        parse_ecb_xml("   ")


def test_parse_xml_with_no_cubes_raises_parse_error():
    """GIVEN valid XML but no Cube elements WHEN parsed THEN ParseError."""
    xml_no_cubes = """<?xml version="1.0"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01">
<gesmes:subject>Reference rates</gesmes:subject>
</gesmes:Envelope>"""

    with pytest.raises(ParseError):
        parse_ecb_xml(xml_no_cubes)


# ── Fallback (spec scenario) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ecb_unreachable_falls_back_to_config_rates(
    respx_mock: respx.MockRouter,
):
    """GIVEN ECB API is down WHEN fetch_rates runs THEN config fallback rates returned.

    Design: ECB is primary, config is fallback. The function must NOT raise
    when ECB is unreachable — it returns config defaults instead.
    Config fallback rates (eur_sek_fallback=11.50, eur_dkk_fallback=7.45,
    eur_nok_fallback=12.00) are from the Settings frozen defaults.
    """
    respx_mock.get(
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    ).respond(500)

    async with httpx.AsyncClient() as client:
        rates = await fetch_rates(
            client,
            url="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
        )

    # Must return config fallback rates, NOT raise
    assert rates["EUR_SEK"] == Decimal("11.50")
    assert rates["EUR_DKK"] == Decimal("7.45")
    assert rates["EUR_NOK"] == Decimal("12.00")


@pytest.mark.asyncio
async def test_ecb_timeout_falls_back_to_config_rates(
    respx_mock: respx.MockRouter,
):
    """GIVEN ECB API times out WHEN fetch_rates runs THEN config fallback rates."""
    respx_mock.get(
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    ).mock(side_effect=httpx.ConnectTimeout("timeout"))

    async with httpx.AsyncClient() as client:
        rates = await fetch_rates(
            client,
            url="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
        )

    assert rates["EUR_SEK"] == Decimal("11.50")


# ── Full fetch+parse integration ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_and_parse_returns_correct_rates(
    respx_mock: respx.MockRouter,
):
    """GIVEN successful ECB HTTP response WHEN fetch_rates runs THEN rates dict returned."""
    respx_mock.get(
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    ).respond(200, text=_ECB_XML)

    async with httpx.AsyncClient() as client:
        rates = await fetch_rates(
            client,
            url="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
        )

    assert rates["EUR_SEK"] == Decimal("11.5000")
    assert rates["EUR_DKK"] == Decimal("7.4500")
    assert rates["EUR_NOK"] == Decimal("12.0000")
