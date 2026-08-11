"""Async fetch and parse SSB Statbank table 09654 for Norwegian fuel prices.

Posts a JSON-stat query to ``https://data.ssb.no/api/v0/en/table/09654``
and parses the JSON-stat2 response to extract NOK prices for Euro 95 and
Diesel in Norway.

The JSON-stat2 response has three dimensions: ``PetroleumProd`` (fuel product
codes 031/035), ``ContentsCode`` (always "Priser"), and ``Tid`` (month, e.g.
``2026M05``). Values are flattened in dimension-order and converted to
``price_nok`` dicts.

Raises:
    UpstreamError: HTTP or network failure fetching the data.
    ParseError: Schema drift — expected dimensions or categories missing.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, cast

import httpx

from models.errors import ParseError, UpstreamError

logger = logging.getLogger(__name__)

# Map SSB PetroleumProd codes to our FuelType enum values.
# 031 = "Motor gasoline, leadfree 95 octan", 035 = "Dutiable diesel"
_FUEL_MAP: dict[str, str] = {
    "031": "euro_95",
    "035": "diesel",
}

# Updated JSON-stat query for SSB table 09654.
# Dimensions: PetroleumProd (fuel product), ContentsCode (always "Priser"),
# Tid (month). Uses numeric codes for PetroleumProd (031/035).
_SSB_QUERY: dict[str, Any] = {
    "query": [
        {
            "code": "PetroleumProd",
            "selection": {
                "filter": "item",
                "values": ["031", "035"],
            },
        },
        {
            "code": "ContentsCode",
            "selection": {
                "filter": "item",
                "values": ["Priser"],
            },
        },
        {
            "code": "Tid",
            "selection": {"filter": "all", "values": ["*"]},
        },
    ],
    "response": {"format": "json-stat2"},
}


async def fetch_and_parse(
    client: httpx.AsyncClient,
    url: str,
) -> list[dict[str, Any]]:
    """POST to *url* with a JSON-stat query and return raw price dicts for NO.

    Returns a list of dicts with keys ``country``, ``fuel``, ``price_nok``,
    ``date`` — ready for the normalizer.
    """
    try:
        response = await client.post(
            url, json=_SSB_QUERY, follow_redirects=True
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise UpstreamError(
            f"Failed to fetch {url}: {exc}",
            status_code=502,
        ) from exc

    return parse_jsonstat_response(response.json())


def parse_jsonstat_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse a JSON-stat2 response dict into raw NO price records.

    Handles 3-dimensional responses (PetroleumProd × ContentsCode × Tid).
    ContentsCode always has a single value ("Priser") — the price column.

    Raises ParseError if the expected dimensions or their category indices
    are missing — never silently emits incomplete or empty records.
    """
    dimension = _require_dimension(data)

    # PetroleumProd dimension (fuel product codes)
    prod_dim = dimension.get("PetroleumProd")
    if prod_dim is None:
        raise ParseError("SSB response missing PetroleumProd dimension")
    prod_idx = _require_category_index(cast(dict[str, Any], prod_dim), "PetroleumProd")

    # Tid dimension (month)
    tid_dim = dimension.get("Tid")
    if tid_dim is None:
        raise ParseError("SSB response missing Tid dimension")
    tid_idx = _require_category_index(cast(dict[str, Any], tid_dim), "Tid")

    size: list[int] = cast(list[int], data.get("size", []))

    if len(size) < 3:
        raise ParseError(
            f"SSB response expected 3 dimensions, got {len(size)}: {size}"
        )

    values: list[float] = cast(list[float], data.get("value", []))

    n_prod = size[0]
    n_cont = size[1]  # ContentsCode — always 1 in table 09654
    n_tid = size[2]

    records: list[dict[str, Any]] = []

    for i_prod in range(n_prod):
        prod_label = _key_by_index(prod_idx, i_prod)
        fuel = _FUEL_MAP.get(prod_label)
        if fuel is None:
            logger.debug("Skipping non-target fuel: %s", prod_label)
            continue

        for i_cont in range(n_cont):
            for i_tid in range(n_tid):
                flat_idx = (i_prod * n_cont + i_cont) * n_tid + i_tid
                try:
                    raw_value = values[flat_idx]
                except IndexError:
                    raise ParseError(
                        f"SSB value index {flat_idx} out of range "
                        f"(size={len(values)})"
                    )

                tid_label = _key_by_index(tid_idx, i_tid)
                record_date = _parse_tid(tid_label)

                if raw_value is None:
                    logger.debug(
                        "Skipping SSB record with None value at index %d", flat_idx
                    )
                    continue

                records.append(
                    {
                        "country": "NO",
                        "fuel": fuel,
                        "price_nok": Decimal(str(raw_value)),
                        "date": record_date,
                    }
                )

    return records


# ── Helpers ───────────────────────────────────────────────────────────────


def _require_dimension(data: dict[str, Any]) -> dict[str, Any]:
    """Return the ``dimension`` sub-dict or raise ParseError."""
    dim = data.get("dimension")
    if not isinstance(dim, dict):
        raise ParseError("SSB response missing or invalid 'dimension' key")
    return cast(dict[str, Any], dim)


def _require_category_index(
    dimension_entry: dict[str, Any],
    dimension_name: str,
) -> dict[str, int]:
    """Return the category index dict for *dimension_entry* or raise ParseError."""
    category = dimension_entry.get("category")
    if not isinstance(category, dict):
        raise ParseError(
            f"SSB {dimension_name} dimension missing 'category'"
        )
    index = category.get("index")
    if not isinstance(index, dict):
        raise ParseError(
            f"SSB {dimension_name} category missing 'index'"
        )
    return cast(dict[str, int], index)


def _key_by_index(index: dict[str, int], idx: int) -> str:
    """Return the key whose value is *idx* in the category index."""
    for key, val in index.items():
        if val == idx:
            return key
    return ""  # unreachable if index is well-formed


def _parse_tid(label: str) -> date:
    """Convert a JSON-stat Tid label like ``2026M05`` to ``date(2026, 5, 1)``.

    Raises ParseError if the format is unrecognized.
    """
    try:
        year = int(label[:4])
        month = int(label[5:7])
        return date(year, month, 1)
    except (ValueError, IndexError):
        raise ParseError(f"Unable to parse SSB Tid label: {label!r}")
