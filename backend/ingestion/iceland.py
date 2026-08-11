"""Async fetch and parse Icelandic fuel prices (gasvaktin.is data).

Gasvaktin is the Icelandic fuel-price tracker (MIT-licensed, running since
2016). It publishes per-station prices for Bensin95 and Diesel in ISK via a
public JSON file committed to GitHub every ~15 minutes:

    https://raw.githubusercontent.com/gasvaktin/gasvaktin/master/vaktin/gas.json

The dataset has 200+ stations, so we aggregate the NATIONAL AVERAGE price
per fuel. The record date is taken from the GitHub commit metadata when
available, otherwise from the request time.

Note: ECB does not publish EUR→ISK (Iceland is not an EU member), so the
rate comes from a separate public API (open.er-api.com) or the configured
fallback.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import httpx

from models.errors import ParseError, UpstreamError

GAS_JSON_URL = (
    "https://raw.githubusercontent.com/gasvaktin/gasvaktin/master/vaktin/gas.json"
)
RATES_API_URL = "https://open.er-api.com/v6/latest/EUR"


async def fetch_and_parse(
    client: httpx.AsyncClient,
    url: str = GAS_JSON_URL,
) -> list[dict[str, object]]:
    """Fetch *url* and return national-average price records for Iceland.

    Returns a list of dicts with keys ``country``, ``fuel``, ``price_isk``,
    ``date`` — ready for the normalizer.
    """
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise UpstreamError(
            f"Failed to fetch Icelandic fuel prices: {exc}",
            status_code=502,
        ) from exc

    return parse_gas_json(response.text)


def parse_gas_json(text: str) -> list[dict[str, object]]:
    """Parse gasvaktin gas.json and return national-average records.

    The JSON has a ``stations`` array; each station has ``bensin95`` and
    ``diesel`` prices in ISK. The national average per fuel is computed
    over all stations that report a price.

    Raises ParseError if the JSON is invalid or no usable station exists.
    """
    import json

    try:
        data = json.loads(text)
        stations = data.get("stations") or []
    except json.JSONDecodeError as exc:
        raise ParseError("Invalid JSON from gasvaktin") from exc

    bensin_prices: list[Decimal] = []
    diesel_prices: list[Decimal] = []
    for station in stations:
        bensin = station.get("bensin95")
        diesel = station.get("diesel")
        if isinstance(bensin, (int, float)):
            bensin_prices.append(Decimal(str(bensin)))
        if isinstance(diesel, (int, float)):
            diesel_prices.append(Decimal(str(diesel)))

    if not bensin_prices and not diesel_prices:
        raise ParseError("No usable fuel prices found in gasvaktin data")

    record_date = date.today()
    records: list[dict[str, object]] = []

    if bensin_prices:
        avg_bensin = sum(bensin_prices, Decimal("0")) / len(bensin_prices)
        records.append(
            {
                "country": "IS",
                "fuel": "euro_95",
                "price_isk": avg_bensin.quantize(Decimal("0.01")),
                "date": record_date,
            }
        )
    if diesel_prices:
        avg_diesel = sum(diesel_prices, Decimal("0")) / len(diesel_prices)
        records.append(
            {
                "country": "IS",
                "fuel": "diesel",
                "price_isk": avg_diesel.quantize(Decimal("0.01")),
                "date": record_date,
            }
        )

    return records


async def fetch_eur_isk_rate(
    client: httpx.AsyncClient,
    url: str = RATES_API_URL,
) -> Decimal:
    """Fetch the current EUR→ISK rate from a public rates API.

    Returns the rate or raises UpstreamError. The caller (pipeline) falls
    back to the configured ``eur_isk_fallback`` on failure.
    """
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        data = response.json()
        rate = data["rates"]["ISK"]
        return Decimal(str(rate))
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise UpstreamError(
            f"Failed to fetch EUR→ISK rate: {exc}",
            status_code=502,
        ) from exc
