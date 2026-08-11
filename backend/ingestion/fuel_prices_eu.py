"""Async fetch and parse fuel-prices.eu/llms.txt for SE/DK/FI fuel prices.

Parses the fixed-width table format published by fuel-prices.eu, extracting
Euro 95 (first € column) and Diesel (second € column) prices for Sweden,
Denmark, and Finland. The date is read from the ``Last updated:`` header.

Raises:
    UpstreamError: HTTP or network failure fetching the data.
    ParseError: Unrecognized format — no table found or no Nordics parsed.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal

import httpx

from models.errors import ParseError, UpstreamError

TARGET_COUNTRIES = frozenset({"SE", "DK", "FI"})

# Matches the two € prices in a table row (Euro 95 first, Diesel second).
_EURO_PRICE_RE = re.compile(r"€\s*(\d+\.\d+)")


async def fetch_and_parse(
    client: httpx.AsyncClient,
    url: str,
) -> list[dict[str, object]]:
    """Fetch *url* and return raw price records for SE/DK/FI.

    Returns a list of dicts with keys ``country``, ``fuel``, ``price_eur``,
    ``date`` — ready for the normalizer.
    """
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise UpstreamError(
            f"Failed to fetch {url}: {exc}",
            status_code=502,
        ) from exc

    return parse_llms_txt(response.text)


def parse_llms_txt(text: str) -> list[dict[str, object]]:
    """Parse llms.txt content and return raw records for SE/DK/FI.

    Raises ParseError if the format is unrecognized or no Nordic countries
    are found.
    """
    lines = text.splitlines()
    record_date = _extract_date(lines)
    records: list[dict[str, object]] = []

    in_table = False
    for line in lines:
        stripped = line.strip()

        # Detect table header: "CC   Country ..."
        if stripped.startswith("CC") and "Country" in stripped:
            in_table = True
            continue

        # Skip separator line: "---...---"
        if in_table and set(stripped) <= {"-", " "}:
            continue

        # End of table: blank line after data rows
        if in_table and not stripped:
            break

        if in_table:
            country = stripped[:2]
            if country not in TARGET_COUNTRIES:
                continue

            prices = _EURO_PRICE_RE.findall(stripped)
            if len(prices) < 2:
                continue  # malformed row, skip rather than crash

            records.append(
                {
                    "country": country,
                    "fuel": "euro_95",
                    "price_eur": Decimal(prices[0]),
                    "date": record_date,
                }
            )
            records.append(
                {
                    "country": country,
                    "fuel": "diesel",
                    "price_eur": Decimal(prices[1]),
                    "date": record_date,
                }
            )

    if not records:
        raise ParseError(
            "No Nordic country price data found in llms.txt response"
        )

    return records


def _extract_date(lines: list[str]) -> date | None:
    """Parse ``Last updated: YYYY-MM-DD`` from the header lines.

    Returns None if the header is missing or unparseable.
    """
    for line in lines:
        if line.strip().startswith("Last updated:"):
            try:
                date_str = line.strip().split(":", 1)[1].strip()
                return datetime.strptime(date_str, "%Y-%m-%d").date()
            except (ValueError, IndexError):
                return None
    return None
