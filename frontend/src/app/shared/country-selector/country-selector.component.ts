import { Component, inject, Input, output, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { CountryStateService, type Country } from '@core/services/country-state.service';
import { COUNTRY_CODES } from '../models/country';
import { flagSvg } from '../constants/flags';

/**
 * Country selector — pill tabs or dropdown.
 *
 * Design: nordicpump-redesign.html → .country-tabs
 * - Pill-shaped tabs (border-radius 999px), selected = primary bg
 * - Format: "SE · Suecia"
 * - Selected country writes to CountryStateService
 * - Accessibility: role="radiogroup", aria-label, keyboard navigation, swipe
 */
interface CountryMeta {
  code: Country;
  flag: SafeHtml;
}

function buildFlag(country: Country, sanitizer: DomSanitizer): SafeHtml {
  return sanitizer.bypassSecurityTrustHtml(flagSvg(country, 18, 12));
}

@Component({
  selector: 'app-country-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .country-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 2px 0 8px;
    }
    .country-tab {
      border: 1px solid var(--color-hairline-strong);
      background: var(--color-surface);
      color: var(--color-text-muted);
      border-radius: 999px;
      padding: 0 16px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    }
    .country-tab[aria-selected="true"] {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-color: var(--color-primary);
    }
    .country-tab .code { font-weight: 700; }
    .country-tab[aria-selected="true"] .name { color: var(--color-on-primary); }
    .country-tab:not([aria-selected="true"]) .name { color: var(--color-text-muted); }
    .flag { display: inline-flex; }
  `],
  template: `
    @if (variant === 'buttons') {
      <div
        role="radiogroup"
        [attr.aria-label]="translate.instant('country.selectorLabel')"
        class="country-tabs"
        (keydown)="onKeydown($event)"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        @for (c of countries; track c.code) {
          <button
            role="radio"
            class="country-tab"
            [attr.aria-selected]="selected() === c.code"
            [attr.aria-checked]="selected() === c.code"
            [attr.data-country]="c.code"
            [attr.tabindex]="selected() === c.code ? 0 : -1"
            [title]="countryName(c.code)"
            (click)="select(c.code)"
          >
            <span class="flag" [innerHTML]="c.flag"></span>
            <span class="code">{{ c.code }}</span>
            <span class="name">· {{ countryName(c.code) }}</span>
          </button>
        }
      </div>
    } @else {
      <select
        [attr.aria-label]="translate.instant('country.dropdownLabel')"
        class="px-3 py-2 rounded-md bg-surface border border-hairline text-text text-body-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
        [value]="selected()"
        (change)="onDropdownChange($event)"
      >
        @for (c of countries; track c.code) {
          <option [value]="c.code">{{ c.code }} · {{ countryName(c.code) }}</option>
        }
      </select>
    }
  `,
})
export class CountrySelectorComponent {
  private readonly service = inject(CountryStateService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly translate = inject(TranslateService);

  @Input() variant: 'buttons' | 'dropdown' = 'buttons';

  /** Emits when user selects a country. */
  readonly countrySelected = output<Country>();

  protected readonly countries: CountryMeta[];

  protected selected = this.service.selectedCountry;

  private touchStartX = 0;

  constructor() {
    this.countries = COUNTRY_CODES.map((code) => ({
      code,
      flag: buildFlag(code, this.sanitizer),
    }));
  }

  protected countryName(code: Country): string {
    return this.translate.instant(`country.${code}`);
  }

  select(code: Country): void {
    this.service.setCountry(code);
    this.countrySelected.emit(code);
  }

  protected onDropdownChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.select(select.value as Country);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();

    const codes = this.countries.map((c) => c.code);
    const currentIdx = codes.indexOf(this.selected());
    let nextIdx: number;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (currentIdx + 1) % codes.length;
    } else {
      nextIdx = (currentIdx - 1 + codes.length) % codes.length;
    }

    this.select(codes[nextIdx] as Country);
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(dx) < 50) return;

    const codes = this.countries.map((c) => c.code);
    const currentIdx = codes.indexOf(this.selected());
    let nextIdx: number;

    if (dx < 0) {
      nextIdx = (currentIdx + 1) % codes.length;
    } else {
      nextIdx = (currentIdx - 1 + codes.length) % codes.length;
    }

    this.select(codes[nextIdx] as Country);
  }
}
