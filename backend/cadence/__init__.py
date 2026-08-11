"""Domain helpers for ingestion cadence decisions.

Pure time-window predicates used by the scheduler to decide when each
upstream source should be ingested (EU on Sundays — when the fuel APIs
publish their weekly snapshot — SSB on new month + mid-month publish day).
Kept free of asyncio and I/O so they are trivially unit-testable.
"""

from __future__ import annotations

from datetime import datetime


def is_sunday(dt: datetime) -> bool:
    """Return True if *dt* falls on a Sunday (weekday 6).

    The fuel-price APIs (fuel-prices.eu, EU Oil Bulletin) publish their
    weekly snapshot on Sundays — ingesting that day captures the freshest
    data for the week.
    """
    return dt.weekday() == 6


def is_friday(dt: datetime) -> bool:
    """Return True if *dt* falls on a Friday (weekday 4).

    Kept for backwards compatibility with older callers/tests.
    """
    return dt.weekday() == 4


def is_new_month(current: int, previous: int | None) -> bool:
    """Return True if *current* month differs from *previous* (or first run)."""
    if previous is None:
        return True
    return current != previous


def is_ssb_publish_day(dt: datetime) -> bool:
    """Return True on the 15th of the month — SSB's typical publish day.

    Statistics Norway releases the monthly fuel-price table around
    mid-month; checking on the 15th lets us pick up the new snapshot as
    soon as it lands, in addition to the month-change trigger on the 1st.
    """
    return dt.day == 15
