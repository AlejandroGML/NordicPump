"""NordicPump data models — typed domain objects for price data.

This module is part of the **Domain/Config/Cache** sub-domain (Community C0):

  - ``backend/models/`` — domain types (PriceRecord, Country, FuelType, errors)
  - ``backend/config.py`` — application settings
  - ``backend/cache/`` — cache layer (CacheStore, CacheFreshness, FileCache)

These three modules form a stable foundation with zero cross-dependencies
into services, routes, or ingestion. Changes here affect the entire tree.
"""
