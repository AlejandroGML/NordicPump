import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CountryStateService } from './country-state.service';
import type { Country } from './country-state.service';

/**
 * Spec: dashboard-core > CountryStateService
 * - Signal-based: selectedCountry signal, defaults to 'SE'
 * - setCountry(code: Country) method
 * - Signal reactivity verified via direct read
 */
describe('CountryStateService', () => {
  let service: CountryStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CountryStateService],
    });
    service = TestBed.inject(CountryStateService);
  });

  describe('selectedCountry default', () => {
    it('should default to Sweden (SE)', () => {
      expect(service.selectedCountry()).toBe('SE');
    });
  });

  describe('setCountry', () => {
    it('should update selectedCountry signal to Denmark (DK)', () => {
      service.setCountry('DK');
      expect(service.selectedCountry()).toBe('DK');
    });

    it('should update selectedCountry signal to Finland (FI)', () => {
      service.setCountry('FI');
      expect(service.selectedCountry()).toBe('FI');
    });

    it('should update selectedCountry signal to Norway (NO)', () => {
      service.setCountry('NO');
      expect(service.selectedCountry()).toBe('NO');
    });

    it('should update back to Sweden (SE)', () => {
      service.setCountry('DK');
      service.setCountry('SE');
      expect(service.selectedCountry()).toBe('SE');
    });
  });

  describe('signal reactivity', () => {
    it('should allow external code to read the signal value', () => {
      const initial = service.selectedCountry();
      service.setCountry('NO');
      const updated = service.selectedCountry();
      expect(initial).toBe('SE');
      expect(updated).toBe('NO');
      expect(updated).not.toBe(initial);
    });
  });
});
