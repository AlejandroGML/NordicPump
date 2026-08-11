import { Injectable, signal } from '@angular/core';
import { type Country } from '@shared/models/country';

export type { Country };

/**
 * Shared country state for the dashboard.
 *
 * Spec: dashboard-core > CountryStateService
 * - Central signal for selected Nordic country
 * - Defaults to Sweden (SE)
 * - Components read the signal reactively; CountrySelector writes via setCountry()
 */

@Injectable({ providedIn: 'root' })
export class CountryStateService {
  readonly selectedCountry = signal<Country>('SE');

  setCountry(code: Country): void {
    this.selectedCountry.set(code);
  }
}
