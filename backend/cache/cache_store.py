"""Atomic file-based JSON storage for normalized price records.

CacheStore handles all I/O: reading, writing (with atomic os.replace),
exists checks, and path resolution. Every write produces both the main
cache file and per-country index files for O(1) lookup.

The file format is:
    {"cached_at": "<ISO-8601>", "records": [...]}
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from models.errors import CacheMissError
from models.price import PriceRecord


class CacheStore:
    """File-based JSON cache store with atomic writes and country indices."""

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)

    # ── Public API ───────────────────────────────────────────────────────

    def read(self, source: str) -> list[PriceRecord]:
        """Return cached records for *source* or raise CacheMissError."""
        path = self._path(source)
        if not path.exists():
            raise CacheMissError(f"Cache miss: no cache file for {source!r}")

        try:
            data = self._load(path)
        except (json.JSONDecodeError, OSError):
            raise CacheMissError(
                f"Cache miss: corrupt or unreadable cache file for {source!r}"
            )

        if "records" not in data:
            raise CacheMissError(
                f"Cache miss: missing 'records' key in cache file for {source!r}"
            )

        records: list[dict[str, Any]] = cast(list[dict[str, Any]], data["records"])
        return [PriceRecord(**r) for r in records]

    def write(self, source: str, records: list[PriceRecord]) -> None:
        """Atomically write *records* to the cache file for *source*.

        Uses tempfile + os.replace to guarantee the existing file is never
        corrupted by a partial or failed write (POSIX atomic rename).

        Also writes per-country index files for O(1) country-based lookup.
        """
        path = self._path(source)

        cache_data = {
            "cached_at": datetime.now(UTC).isoformat(),
            "records": [r.model_dump(mode="json") for r in records],
        }

        self._atomic_write_json(path, cache_data)

        # ── Write per-country index files ────────────────────────────────
        self._write_country_indices(source, records)

    def exists(self, source: str) -> bool:
        """Check whether a cache file exists for *source*."""
        return self._path(source).exists()

    # ── Internal ─────────────────────────────────────────────────────────

    def _load(self, path: Path) -> dict[str, Any]:
        """Load and parse a JSON cache file, returning the raw dict."""
        return json.loads(path.read_text(encoding="utf-8"))  # type: ignore[no-any-return]

    def _atomic_write_json(self, path: Path, data: dict[str, Any]) -> None:
        """Atomically write *data* as JSON to *path* via tempfile + os.replace.

        Guarantees the existing file is never corrupted by a partial or
        failed write (POSIX atomic rename).
        """
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, default=str)
            os.replace(tmp_path, str(path))
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _path(self, source: str) -> Path:
        """Return the absolute Path to the cache file for *source*."""
        return self.cache_dir / f"{source}.json"

    def _index_path(self, source: str, country: str) -> Path:
        """Return the absolute Path to a country index file."""
        return self.cache_dir / f"{source}_idx_{country}.json"

    def _write_country_indices(
        self, source: str, records: list[PriceRecord],
    ) -> None:
        """Group *records* by country and write one index file per country.

        Each index file has the same structure as the main cache file:
        ``{"cached_at": "<ISO-8601>", "records": [...]}``.
        """
        grouped: dict[str, list[PriceRecord]] = {}
        for record in records:
            key = record.country.value
            grouped.setdefault(key, []).append(record)

        for country_code, country_records in grouped.items():
            idx_path = self._index_path(source, country_code)
            idx_data = {
                "cached_at": datetime.now(UTC).isoformat(),
                "records": [r.model_dump(mode="json") for r in country_records],
            }
            self._atomic_write_json(idx_path, idx_data)
