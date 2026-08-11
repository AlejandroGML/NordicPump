/**
 * Shared PriceRecord and PriceResponse interfaces matching the backend API.
 *
 * ═══════════════════════════════════════════════════════════════════
 * MUST stay in sync with backend/models/price.py — PriceRecord.
 * Validated by price.contract.spec.ts.
 * ═══════════════════════════════════════════════════════════════════
 *
 * These types are used across dashboard components that consume
 * GET /api/v1/prices/{country}.
 */

import { type Country } from './country';

export interface PriceRecord {
  country: Country;
  fuel: 'euro_95' | 'diesel';
  price_eur: number;
  price_native: number;
  price_native_currency: string;
  price_sek: number;
  date: string;
  frequency: string;
}

export interface PriceResponse {
  country: Country;
  prices: PriceRecord[];
}
