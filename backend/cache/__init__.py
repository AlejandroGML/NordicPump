"""Cache layer — atomic file-based JSON storage and freshness tracking.

This module is part of the **Domain/Config/Cache** sub-domain (Community C0):

  - ``backend/models/`` — domain types (PriceRecord, Country, FuelType, errors)
  - ``backend/config.py`` — application settings
  - ``backend/cache/`` — cache layer (this module)

Contains:
  - ``CacheStore`` — atomic I/O with tempfile + os.replace, country index files
  - ``CacheFreshness`` — time-window freshness checks
  - ``FileCache`` — backward-compatible facade composing store + freshness
"""
