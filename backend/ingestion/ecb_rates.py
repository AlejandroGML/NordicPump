"""Async fetch and parse ECB daily reference rates for Nordic currencies.

Fetches the ECB's ``eurofxref-daily.xml`` and extracts EUR→SEK, EUR→DKK,
and EUR→NOK reference rates. Rates are returned as Decimal values.

Fallback behaviour: if the ECB API is unreachable, the function returns the
configured fallback rates from ``config.Settings`` instead of raising.
Only raises UpstreamError if **both** the ECB and config fallback are
unavailable (should not happen in production — config always has defaults).

Raises:
    ParseError: XML is malformed or expected currency rates are missing.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from xml.etree import ElementTree

import httpx

from config import Settings
from models.errors import ParseError, UpstreamError

logger = logging.getLogger(__name__)

# The XML default namespace used by ECB
_ECB_NS = "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"

_TARGET_CURRENCIES = frozenset({"SEK", "DKK", "NOK"})

_CURRENCY_KEY_MAP = {
    "SEK": "EUR_SEK",
    "DKK": "EUR_DKK",
    "NOK": "EUR_NOK",
}


async def fetch_rates(
    client: httpx.AsyncClient,
    url: str,
) -> dict[str, Decimal]:
    """Fetch ECB reference rates and return ``{EUR_SEK, EUR_DKK, EUR_NOK}``.

    On HTTP/network failure, returns the configured fallback rates from
    Settings. Only raises UpstreamError if fallback is also unavailable.
    """
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("ECB API unreachable (%s), using config fallback rates", exc)
        return _fallback_rates()

    return parse_ecb_xml(response.text)


def parse_ecb_xml(xml_text: str) -> dict[str, Decimal]:
    """Parse ECB daily reference XML and return EUR→SEK/DKK/NOK rates.

    Raises ParseError if the XML is malformed or any of the three target
    currencies are missing.
    """
    if not xml_text.strip():
        raise ParseError("ECB response was empty")

    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        raise ParseError(f"ECB response is not valid XML: {exc}") from exc

    # Find Cube elements with currency/rate attributes
    ns = {"ecb": _ECB_NS}
    rates: dict[str, Decimal] = {}

    for cube in root.iterfind(".//ecb:Cube[@currency][@rate]", ns):
        currency = cube.get("currency", "")
        if currency in _TARGET_CURRENCIES:
            try:
                rate = Decimal(cube.get("rate", ""))
            except Exception:
                raise ParseError(
                    f"ECB rate for {currency} is not a valid decimal"
                )
            key = _CURRENCY_KEY_MAP[currency]
            rates[key] = rate

    # Validate we got all three required rates
    missing = set(_CURRENCY_KEY_MAP.values()) - set(rates.keys())
    if missing:
        raise ParseError(
            f"ECB response missing required rate(s): {', '.join(sorted(missing))}"
        )

    return rates


def _fallback_rates() -> dict[str, Decimal]:
    """Return fallback rates from config Settings.

    Raises UpstreamError if any fallback rate is zero or missing.
    """
    settings = Settings()
    rates = {
        "EUR_SEK": settings.eur_sek_fallback,
        "EUR_DKK": settings.eur_dkk_fallback,
        "EUR_NOK": settings.eur_nok_fallback,
    }

    missing = [k for k, v in rates.items() if not v or v <= 0]
    if missing:
        raise UpstreamError(
            f"ECB unavailable and config fallback rates missing: {missing}",
            status_code=503,
        )

    logger.info("Using config fallback rates: EUR_SEK=%s", rates["EUR_SEK"])
    return rates
