"""Tests for Icelandic fuel price ingestion (gasvaktin)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from ingestion.iceland import parse_gas_json

SAMPLE_GAS_JSON = """{
  "stations": [
    {"bensin95": 200.0, "diesel": 230.0, "name": "A"},
    {"bensin95": 210.0, "diesel": 240.0, "name": "B"},
    {"bensin95": 220.0, "diesel": null, "name": "C"}
  ]
}"""


@pytest.mark.unit
def test_parse_gas_json_computes_national_average() -> None:
    """GIVEN gasvaktin JSON WHEN parsed THEN national averages returned."""
    records = parse_gas_json(SAMPLE_GAS_JSON)

    assert len(records) == 2
    by_fuel = {r["fuel"]: r for r in records}

    # Bensin95 avg = (200 + 210 + 220) / 3 = 210.00
    assert by_fuel["euro_95"]["price_isk"] == Decimal("210.00")
    # Diesel avg = (230 + 240) / 2 = 235.00 (station C has no diesel)
    assert by_fuel["diesel"]["price_isk"] == Decimal("235.00")
    assert by_fuel["euro_95"]["country"] == "IS"


@pytest.mark.unit
def test_parse_gas_json_raises_on_empty_stations() -> None:
    """GIVEN JSON without usable stations WHEN parsed THEN ParseError."""
    from models.errors import ParseError

    with pytest.raises(ParseError):
        parse_gas_json('{"stations": []}')
