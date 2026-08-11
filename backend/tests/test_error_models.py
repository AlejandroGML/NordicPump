"""Tests for models/errors.py — typed error hierarchy."""

import pytest

# --- Base Error ---

def test_base_error_is_exception():
    """AppError must be a subclass of Exception."""
    from models.errors import AppError

    assert issubclass(AppError, Exception)


def test_base_error_has_code_and_message():
    """AppError must expose code and message attributes."""
    from models.errors import AppError

    err = AppError("Something went wrong", code="TEST_ERROR")

    assert err.message == "Something went wrong"
    assert err.code == "TEST_ERROR"
    assert str(err) == "[TEST_ERROR] Something went wrong"


def test_base_error_default_code():
    """AppError should default to INTERNAL_ERROR code."""
    from models.errors import AppError

    err = AppError("Generic failure")

    assert err.code == "INTERNAL_ERROR"
    assert err.message == "Generic failure"


# --- UpstreamError ---

def test_upstream_error_is_app_error():
    """UpstreamError must be a subclass of AppError."""
    from models.errors import AppError, UpstreamError

    assert issubclass(UpstreamError, AppError)
    assert issubclass(UpstreamError, Exception)


def test_upstream_error_default_code():
    """UpstreamError must default to UPSTREAM_ERROR."""
    from models.errors import UpstreamError

    err = UpstreamError("ECB API unreachable")

    assert err.code == "UPSTREAM_ERROR"
    assert err.message == "ECB API unreachable"


def test_upstream_error_with_status():
    """UpstreamError may carry an HTTP status code for logging."""
    from models.errors import UpstreamError

    err = UpstreamError("SSB returned 500", status_code=500)

    assert err.status_code == 500


def test_upstream_error_default_status():
    """UpstreamError should default status_code to 502."""
    from models.errors import UpstreamError

    err = UpstreamError("Timeout")
    assert err.status_code == 502


# --- CacheMissError ---

def test_cache_miss_is_app_error():
    """CacheMissError must be subclass of AppError."""
    from models.errors import AppError, CacheMissError

    assert issubclass(CacheMissError, AppError)


def test_cache_miss_defaults():
    """CacheMissError must default to CACHE_MISS code."""
    from models.errors import CacheMissError

    err = CacheMissError("No cache file for EU data")

    assert err.code == "CACHE_MISS"
    assert err.message == "No cache file for EU data"


# --- UnsupportedCountryError ---

def test_unsupported_country_is_app_error():
    """UnsupportedCountryError must be subclass of AppError."""
    from models.errors import AppError, UnsupportedCountryError

    assert issubclass(UnsupportedCountryError, AppError)


def test_unsupported_country_defaults():
    """UnsupportedCountryError defaults to UNSUPPORTED_COUNTRY code."""
    from models.errors import UnsupportedCountryError

    err = UnsupportedCountryError("XX is not a supported country")

    assert err.code == "UNSUPPORTED_COUNTRY"
    assert err.message == "XX is not a supported country"


def test_unsupported_country_factory():
    """Convenience constructor with country code."""
    from models.errors import UnsupportedCountryError

    err = UnsupportedCountryError.for_country("XX")

    assert "XX" in err.message
    assert err.code == "UNSUPPORTED_COUNTRY"


# --- ParseError ---

def test_parse_error_is_app_error():
    """ParseError must be subclass of AppError."""
    from models.errors import AppError, ParseError

    assert issubclass(ParseError, AppError)


def test_parse_error_defaults():
    """ParseError defaults to PARSE_ERROR code."""
    from models.errors import ParseError

    err = ParseError("SSB response schema changed")

    assert err.code == "PARSE_ERROR"
    assert err.message == "SSB response schema changed"


# --- Error to dict (for API envelope) ---

def test_app_error_to_dict():
    """AppError.to_dict() must return {error: {code, message}}."""
    from models.errors import AppError

    err = AppError("Test error", code="TEST")
    envelope = err.to_dict()

    assert envelope == {"error": {"code": "TEST", "message": "Test error"}}


def test_cache_miss_to_dict():
    """CacheMissError.to_dict() must return the correct envelope."""
    from models.errors import CacheMissError

    envelope = CacheMissError("Cache not found").to_dict()

    assert envelope["error"]["code"] == "CACHE_MISS"


def test_error_instances_can_be_raised():
    """All errors must be valid Python exceptions that can be caught."""
    from models.errors import (
        AppError,
        CacheMissError,
        ParseError,
        UnsupportedCountryError,
        UpstreamError,
    )

    for err_cls in [
        AppError,
        UpstreamError,
        CacheMissError,
        UnsupportedCountryError,
        ParseError,
    ]:
        with pytest.raises(err_cls):
            raise err_cls("test")
