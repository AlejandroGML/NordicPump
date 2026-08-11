"""Typed error hierarchy for NordicPump backend.

Follows the error-handling skill pattern: typed exceptions with code/message
that map to the standard API error envelope.
"""

from __future__ import annotations


class AppError(Exception):
    """Base exception for all application errors."""

    default_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        self.message = message
        self.code = code or self.default_code
        super().__init__(f"[{self.code}] {message}")

    def to_dict(self) -> dict[str, dict[str, str]]:
        """Return the standard API error envelope."""
        return {"error": {"code": self.code, "message": self.message}}


class UpstreamError(AppError):
    """An external data source is unreachable or returned an error."""

    default_code = "UPSTREAM_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int = 502,
    ) -> None:
        self.status_code = status_code
        super().__init__(message, code=code)


class CacheMissError(AppError):
    """No cache file exists and upstream is unreachable (cold start)."""

    default_code = "CACHE_MISS"


class UnsupportedCountryError(AppError):
    """The requested country code is not in the supported set."""

    default_code = "UNSUPPORTED_COUNTRY"

    @classmethod
    def for_country(cls, country: str) -> UnsupportedCountryError:
        """Factory: create an error for an unsupported country code."""
        return cls(f"{country!r} is not a supported country")


class ParseError(AppError):
    """External data could not be parsed (schema drift, unexpected format)."""

    default_code = "PARSE_ERROR"
