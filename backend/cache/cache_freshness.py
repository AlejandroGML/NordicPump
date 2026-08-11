"""Time-window freshness checks for cache files.

CacheFreshness is a pure time-window checker — it reads the ``cached_at``
field from a cache file and compares it against the current time. It has
zero awareness of the record contents, serialization, or I/O patterns.

Separation: CacheStore handles I/O; CacheFreshness handles time logic.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast


class CacheFreshness:
    """Read-only freshness checks against a cache file's ``cached_at``."""

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)

    # ── Public API ───────────────────────────────────────────────────────

    def is_fresh(self, source: str, window: timedelta) -> bool:
        """Return True if the cache file exists and is within *window*."""
        path = self._path(source)
        if not path.exists():
            return False

        cached_at = self._load_cached_at(path)
        if cached_at is None:
            return False

        now = datetime.now(UTC)
        age = now - cached_at.replace(tzinfo=UTC)
        return age < window

    def get_cached_at(self, source: str) -> datetime | None:
        """Return the ``cached_at`` timestamp, or None if missing/corrupt."""
        path = self._path(source)
        if not path.exists():
            return None
        return self._load_cached_at(path)

    # ── Internal ─────────────────────────────────────────────────────────

    def _path(self, source: str) -> Path:
        """Return the absolute Path to the cache file for *source*."""
        return self.cache_dir / f"{source}.json"

    def _load_cached_at(self, path: Path) -> datetime | None:
        """Read and parse the ``cached_at`` field from a cache file.

        Returns None if the file is corrupt, has no cached_at, or the
        value cannot be parsed as ISO-8601.
        """
        try:
            data: dict[str, Any] = json.loads(path.read_text())
            return datetime.fromisoformat(cast(str, data["cached_at"]))
        except (json.JSONDecodeError, KeyError, ValueError, OSError):
            return None
