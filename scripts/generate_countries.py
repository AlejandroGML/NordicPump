#!/usr/bin/env python3
"""Generate country/currency code from countries.json (single source of truth).

Generates:
  backend/models/countries.py          — Country enum + metadata + derived maps
  frontend/src/app/shared/models/country.ts            — Country type + COUNTRY_CODES
  frontend/src/app/shared/currency-switcher/currencies.ts — Currency type + constants

Run from repo root:  python scripts/generate_countries.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "countries.json"

BACKEND_OUT = ROOT / "backend" / "models" / "countries.py"
FRONTEND_COUNTRY_OUT = ROOT / "frontend" / "src" / "app" / "shared" / "models" / "country.ts"
FRONTEND_CURRENCY_OUT = (
    ROOT / "frontend" / "src" / "app" / "shared" / "currency-switcher" / "currencies.ts"
)

HEADER_PY = '"""Generated file — DO NOT EDIT. Run: python scripts/generate_countries.py."""\n'
HEADER_TS = "/**\n * GENERATED FILE — DO NOT EDIT. Run: python scripts/generate_countries.py.\n * Source: countries.json\n */\n"


def load() -> dict:
    with SOURCE.open(encoding="utf-8") as fh:
        return json.load(fh)


def gen_backend(data: dict) -> str:
    countries = data["countries"]
    out = [
        HEADER_PY,
        "from __future__ import annotations",
        "",
        "from dataclasses import dataclass",
        "from enum import StrEnum",
        "",
        "",
        "class Country(StrEnum):",
    ]
    for code in countries:
        out.append(f'    {code} = "{code}"')
    out += [
        "",
        "",
        "@dataclass(frozen=True)",
        "class CountryMeta:",
        '    """Metadata for a Nordic country (single source: countries.json)."""',
        "",
        "    currency: str",
        '    """Native currency code (ISO 4217)."""',
        "    source: str",
        '    """Upstream data source key (cache source id)."""',
        "    freshness_window: str",
        '    """Settings attribute holding the freshness window in days."""',
        "    rates_public: bool",
        '    """Whether this currency is exposed via GET /api/v1/rates."""',
        "",
        "",
        "COUNTRIES: dict[Country, CountryMeta] = {",
    ]
    for code, meta in countries.items():
        rates = "True" if meta["rates_public"] else "False"
        out.append(
            f"    Country.{code}: CountryMeta(\n"
            f'        currency="{meta["currency"]}",\n'
            f'        source="{meta["source"]}",\n'
            f'        freshness_window="{meta["freshness_window"]}",\n'
            f"        rates_public={rates},\n"
            "    ),"
        )
    out += [
        "}",
        "",
        "",
        "# ── Derived maps (do not edit by hand) ─────────────────────────────",
        "COUNTRY_SOURCE: dict[Country, str] = {c: m.source for c, m in COUNTRIES.items()}",
        "SOURCE_WINDOW_DAYS: dict[str, str] = {m.source: m.freshness_window for m in COUNTRIES.values()}",
        "RATE_KEYS: dict[str, str] = {",
        "    f\"EUR_{m.currency}\": m.currency",
        "    for m in COUNTRIES.values()",
        "    if m.rates_public",
        "}",
        "VALID_COUNTRIES: list[str] = [c.value for c in Country]",
        "",
    ]
    return "\n".join(out)


def gen_frontend_country(data: dict) -> str:
    codes = list(data["countries"])
    union = " | ".join(f"'{c}'" for c in codes)
    arr = ", ".join(f"'{c}'" for c in codes)
    return (
        HEADER_TS
        + "export type Country = "
        + union
        + ";\n"
        + "export const COUNTRY_CODES: readonly Country[] = ["
        + arr
        + "] as const;\n"
    )


def gen_frontend_currency(data: dict) -> str:
    currencies = list(data["currencies"])
    union = " | ".join(f"'{c}'" for c in currencies)
    arr = ", ".join(f"'{c}'" for c in currencies)
    symbols = "".join(
        f"  {c}: '{data['currencies'][c]['symbol']}',\n" for c in currencies
    )
    locales = "".join(
        f"  {c}: '{data['currencies'][c]['locale']}',\n" for c in currencies
    )
    return (
        HEADER_TS
        + "export type Currency = "
        + union
        + ";\n"
        + "export const CURRENCIES: readonly Currency[] = ["
        + arr
        + "] as const;\n"
        + "export const CURRENCY_SYMBOLS: Record<Currency, string> = {\n"
        + symbols
        + "};\n"
        + "export const CURRENCY_LOCALES: Record<Currency, string> = {\n"
        + locales
        + "};\n"
    )


def main() -> int:
    if not SOURCE.exists():
        print(f"ERROR: {SOURCE} not found — run from repo root", file=sys.stderr)
        return 1
    data = load()
    outs = {
        BACKEND_OUT: gen_backend(data),
        FRONTEND_COUNTRY_OUT: gen_frontend_country(data),
        FRONTEND_CURRENCY_OUT: gen_frontend_currency(data),
    }
    for path, content in outs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"✓ {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
