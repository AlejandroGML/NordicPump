import { Injectable, computed, signal } from '@angular/core';
import { PriceRecord } from '../models/price';

/** Minimum and maximum tank size in liters. */
export const TANK_MIN = 1;
export const TANK_MAX = 200;
export const TANK_DEFAULT = 50;

/**
 * Domain logic for the tank cost calculator — pure computation, no I/O.
 *
 * Holds the tank-size state and derives per-fuel costs from the loaded
 * price records. The component stays a thin view over these signals.
 */
@Injectable({ providedIn: 'root' })
export class TankCalculatorService {
  readonly tankLiters = signal(TANK_DEFAULT);

  /** Price records loaded for the selected country. */
  readonly prices = signal<PriceRecord[]>([]);

  /** Euro 95 price record, if present. */
  readonly euro95Price = computed(() =>
    this.prices().find((p) => p.fuel === 'euro_95') ?? null,
  );

  /** Diesel price record, if present. */
  readonly dieselPrice = computed(() =>
    this.prices().find((p) => p.fuel === 'diesel') ?? null,
  );

  /** Euro 95 total in EUR (universal base): tankLiters × price_eur. */
  readonly euro95CostEur = computed(() => {
    const p = this.euro95Price();
    return p ? this.tankLiters() * p.price_eur : 0;
  });

  /** Diesel total in EUR (universal base): tankLiters × price_eur. */
  readonly dieselCostEur = computed(() => {
    const p = this.dieselPrice();
    return p ? this.tankLiters() * p.price_eur : 0;
  });

  /** Euro 95 total in native currency. */
  readonly euro95CostNative = computed(() => {
    const p = this.euro95Price();
    return p ? this.tankLiters() * p.price_native : 0;
  });

  /** Diesel total in native currency. */
  readonly dieselCostNative = computed(() => {
    const p = this.dieselPrice();
    return p ? this.tankLiters() * p.price_native : 0;
  });

  /** Absolute EUR difference between fuels. */
  readonly savingsAmount = computed(() =>
    Math.abs(this.euro95CostEur() - this.dieselCostEur()),
  );

  /** Which fuel is cheaper: 'euro_95', 'diesel', or null on tie. */
  readonly cheaperFuel = computed<'euro_95' | 'diesel' | null>(() => {
    const e95 = this.euro95CostEur();
    const d = this.dieselCostEur();
    if (e95 < d) return 'euro_95';
    if (d < e95) return 'diesel';
    return null;
  });

  /** Clamp a value to [TANK_MIN, TANK_MAX]. */
  clampLiters(value: number): number {
    if (value < TANK_MIN) return TANK_MIN;
    if (value > TANK_MAX) return TANK_MAX;
    return value;
  }

  /** Set tank size, clamped to valid range. */
  setTankLiters(value: number): void {
    if (isNaN(value)) return;
    this.tankLiters.set(this.clampLiters(value));
  }

  /** Replace the loaded price records. */
  setPrices(records: PriceRecord[]): void {
    this.prices.set(records);
  }
}
