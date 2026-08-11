import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { CountrySelectorComponent } from './country-selector.component';
import { CountryStateService } from '@core/services/country-state.service';

function translateMock(key: string): string {
  const map: Record<string, string> = {
    'country.SE': 'Sweden',
    'country.DK': 'Denmark',
    'country.FI': 'Finland',
    'country.NO': 'Norway',
    'country.selectorLabel': 'Select country',
    'country.dropdownLabel': 'Select country',
  };
  return map[key] ?? key;
}

describe('CountrySelectorComponent', () => {
  let service: CountryStateService;

  function createFixture(
    variant: 'buttons' | 'dropdown' = 'buttons',
  ): ComponentFixture<CountrySelectorComponent> {
    const f = TestBed.createComponent(CountrySelectorComponent);
    f.componentInstance.variant = variant;
    f.detectChanges();
    return f;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountrySelectorComponent],
      providers: [
        CountryStateService,
        { provide: TranslateService, useValue: { instant: translateMock } },
      ],
    }).compileComponents();
    service = TestBed.inject(CountryStateService);
    // Reset to default
    service.setCountry('SE');
  });

  describe('rendering', () => {
    it('should render 5 country options', () => {
      const fixture = createFixture();
      const buttons = fixture.nativeElement.querySelectorAll('[role="radio"]');
      expect(buttons.length).toBe(5);
    });

    it('should pre-select Sweden (SE) by default', () => {
      const fixture = createFixture();
      const selected = fixture.nativeElement.querySelector('[aria-checked="true"]');
      expect(selected).toBeTruthy();
      expect(selected?.getAttribute('data-country')).toBe('SE');
    });

    it('should show country names (Sweden, Denmark, Finland, Norway)', () => {
      const fixture = createFixture();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Sweden');
      expect(text).toContain('Denmark');
      expect(text).toContain('Finland');
      expect(text).toContain('Norway');
    });

    it('should render flag SVGs for each country', () => {
      const fixture = createFixture();
      const svgs = fixture.nativeElement.querySelectorAll('svg');
      expect(svgs.length).toBe(5);
    });
  });

  describe('selection', () => {
    it('should update CountryStateService when clicking Denmark', () => {
      const fixture = createFixture();
      const denmarkBtn = fixture.nativeElement.querySelector('[data-country="DK"]');
      denmarkBtn?.click();
      fixture.detectChanges();
      expect(service.selectedCountry()).toBe('DK');
    });

    it('should update CountryStateService when clicking Norway', () => {
      const fixture = createFixture();
      const norwayBtn = fixture.nativeElement.querySelector('[data-country="NO"]');
      norwayBtn?.click();
      fixture.detectChanges();
      expect(service.selectedCountry()).toBe('NO');
    });

    it('should highlight selected country (aria-selected=true)', () => {
      const fixture = createFixture();
      const denmarkBtn = fixture.nativeElement.querySelector('[data-country="DK"]');
      denmarkBtn?.click();
      fixture.detectChanges();
      expect(denmarkBtn?.getAttribute('aria-selected')).toBe('true');
    });

    it('should show non-selected countries without selection state', () => {
      const fixture = createFixture();
      const denmarkBtn = fixture.nativeElement.querySelector('[data-country="DK"]');
      // Denmark is not selected by default (SE is)
      expect(denmarkBtn?.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('dropdown variant', () => {
    it('should render a select element for dropdown variant', () => {
      const fixture = createFixture('dropdown');
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
    });

    it('should have 5 options in the dropdown', () => {
      const fixture = createFixture('dropdown');
      const options = fixture.nativeElement.querySelectorAll('option');
      expect(options.length).toBe(5);
    });

    it('should update service on dropdown change', () => {
      const fixture = createFixture('dropdown');
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      select.value = 'FI';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(service.selectedCountry()).toBe('FI');
    });
  });

  describe('accessibility', () => {
    it('should have role="radiogroup" on button variant container', () => {
      const fixture = createFixture('buttons');
      const container = fixture.nativeElement.querySelector('[role="radiogroup"]');
      expect(container).toBeTruthy();
    });

    it('should have aria-label on the container', () => {
      const fixture = createFixture();
      const container = fixture.nativeElement.querySelector('[role="radiogroup"]');
      expect(container?.getAttribute('aria-label')).toBeTruthy();
    });

    it('should mark flags with role="img" and aria-label', () => {
      const fixture = createFixture();
      const svgs = fixture.nativeElement.querySelectorAll('svg[role="img"]');
      expect(svgs.length).toBe(5);
      expect(svgs[0]?.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
