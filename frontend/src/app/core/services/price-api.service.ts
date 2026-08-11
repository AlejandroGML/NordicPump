import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, finalize } from 'rxjs';
import { type Country } from '@shared/models/country';
import { PriceResponse } from '@shared/models/price';

/**
 * Centralised price API service with in-flight request deduplication.
 *
 * - Multiple dashboard components subscribing to the SAME country in the
 *   same change-detection tick share ONE HTTP request (dedup in-flight)
 * - No persistent cache: once the request completes, the shared observable
 *   is discarded, so a retry or country change always fetches fresh data
 * - All dashboard components import from here instead of raw HttpClient
 */
@Injectable({ providedIn: 'root' })
export class PriceApiService {
  private readonly http = inject(HttpClient);
  private readonly inFlight = new Map<Country, Observable<PriceResponse>>();

  getPrices(country: Country): Observable<PriceResponse> {
    const existing = this.inFlight.get(country);
    if (existing) return existing;

    const request$ = this.http.get<PriceResponse>(`/api/v1/prices/${country}`).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      finalize(() => this.inFlight.delete(country)),
    );
    this.inFlight.set(country, request$);
    return request$;
  }
}
