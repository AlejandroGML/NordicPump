import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { take } from 'rxjs/operators';
import { PriceApiService } from './price-api.service';

/**
 * Spec: dashboard-core > PriceApiService
 * - Multiple subscribers of the same country in the same tick share ONE request
 * - No persistent cache: a new call after completion issues a fresh request
 */
describe('PriceApiService', () => {
  let service: PriceApiService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PriceApiService],
    }).compileComponents();
    service = TestBed.inject(PriceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should share ONE request for two subscribers of the same country in the same tick', async () => {
    const first = service.getPrices('SE').pipe(take(1)).toPromise();
    const second = service.getPrices('SE').pipe(take(1)).toPromise();

    const req = httpMock.expectOne('/api/v1/prices/SE');
    expect(req.request.method).toBe('GET');
    req.flush({ country: 'SE', prices: [] });

    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    httpMock.verify();
  });

  it('should issue a NEW request when called again after completion', () => {
    service.getPrices('SE').pipe(take(1)).subscribe();
    const req1 = httpMock.expectOne('/api/v1/prices/SE');
    req1.flush({ country: 'SE', prices: [] });

    service.getPrices('SE').pipe(take(1)).subscribe();
    const req2 = httpMock.expectOne('/api/v1/prices/SE');
    req2.flush({ country: 'SE', prices: [] });
    httpMock.verify();
  });

  it('should treat different countries as separate requests', () => {
    service.getPrices('SE').pipe(take(1)).subscribe();
    service.getPrices('NO').pipe(take(1)).subscribe();

    httpMock.expectOne('/api/v1/prices/SE').flush({ country: 'SE', prices: [] });
    httpMock.expectOne('/api/v1/prices/NO').flush({ country: 'NO', prices: [] });
    httpMock.verify();
  });
});
