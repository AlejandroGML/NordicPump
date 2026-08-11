import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/services/lang.service';
import {
  type SupportedLang,
  SUPPORTED_LANGS,
  LANG_NATIVE_NAMES,
} from '@core/models/lang';

/**
 * Language switcher dropdown for the header.
 *
 * Spec: i18n-setup > Language Switcher
 * - 6 options with native names: Svenska, Dansk, Norsk bokmål, Suomi, English, Español
 * - Active language highlighted (selected)
 * - Switcher navigates preserving route suffix (/sv/dashboard → /en/dashboard)
 * - aria-label for a11y
 *
 * Spec: layout-shell > Header Component
 * - Positioned in header
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select
      aria-label="Select Language"
      class="px-3 py-2 rounded-md bg-primary border border-primary-hover text-on-primary text-body-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary min-h-[44px]"
      [value]="activeLang()"
      (change)="onLanguageChange($event)"
    >
      @for (lang of languages; track lang) {
        <option [value]="lang">
          {{ nativeNames[lang] }}
        </option>
      }
    </select>
  `,
})
export class LanguageSwitcherComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly langService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected readonly languages: readonly SupportedLang[] = SUPPORTED_LANGS;
  protected readonly nativeNames: Record<SupportedLang, string> =
    LANG_NATIVE_NAMES;

  /** Tracks the active language reactively via TranslateService events. */
  protected readonly activeLang = signal<SupportedLang>(
    this.langService.getCurrentLanguage(),
  );

  private langSub?: Subscription;

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe((event) => {
      this.activeLang.set(event.lang as SupportedLang);
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  onLanguageChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newLang = select.value as SupportedLang;

    this.langService.setLanguage(newLang);

    // Preserve the current route suffix + query params + fragment when switching language.
    // e.g., /sv/dashboard?foo=bar#section → /en/dashboard?foo=bar#section
    const url = this.router.url;
    const segments = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length > 0) {
      segments[0] = newLang;
    }
    void this.router.navigate(['/' + segments.join('/')], {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
