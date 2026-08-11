import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CountryStateService, type Country } from './country-state.service';
import { PriceApiService } from './price-api.service';
import { PriceResponse } from '@shared/models/price';

/**
 * Combined access point for price data and country state.
 *
 * Components that need both CountryStateService and PriceApiService
 * should inject PriceDataHost instead of both services separately.
 * This reduces boilerplate and provides a single reactive entry point.
 */
@Injectable({ providedIn: 'root' })
export class PriceDataHost {
  readonly country = inject(CountryStateService).selectedCountry;
  private readonly priceApi = inject(PriceApiService);

  /**
   * Fetch prices for a given country. Defaults to the currently selected country.
   */
  getPrices(country?: Country): Observable<PriceResponse> {
    return this.priceApi.getPrices(country ?? this.country());
  }
}
