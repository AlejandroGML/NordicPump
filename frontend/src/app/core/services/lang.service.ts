import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  type SupportedLang,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  isSupportedLang,
} from '../models/lang';

const STORAGE_KEY = 'lang';

/**
 * Central language management service.
 *
 * Spec: i18n-setup > Language Detection Chain
 * Detection priority: localStorage('lang') → navigator.language → 'sv'
 * setLanguage: persists to localStorage, switches translate service,
 *              updates html[lang] and html[dir]
 *
 * currentLang is a signal so consumers react immediately to language changes.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  /** Reactive language signal — components can read this directly. */
  readonly currentLang = signal<SupportedLang>(DEFAULT_LANG);

  /** Detection chain: localStorage → navigator → sv fallback. */
  initLanguage(): SupportedLang {
    const stored = this.readStored();
    if (stored) {
      this.applyLanguage(stored);
      return stored;
    }

    const browser = this.detectBrowserLanguage();
    if (browser) {
      this.applyLanguage(browser);
      return browser;
    }

    this.applyLanguage(DEFAULT_LANG);
    return DEFAULT_LANG;
  }

  /** Switch active language and persist the choice. */
  setLanguage(lang: string): void {
    if (!isSupportedLang(lang)) {
      console.warn(
        `[LanguageService] Unsupported language "${lang}", falling back to ${DEFAULT_LANG}`,
      );
      lang = DEFAULT_LANG;
    }
    this.applyLanguage(lang as SupportedLang);
    this.persistLanguage(lang as SupportedLang);
  }

  /** Return the currently active language code. */
  getCurrentLanguage(): SupportedLang {
    return this.currentLang();
  }

  /** Return the list of all supported language codes. */
  getSupportedLanguages(): readonly SupportedLang[] {
    return SUPPORTED_LANGS;
  }

  /* ---- private helpers ---- */

  private readStored(): SupportedLang | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value && isSupportedLang(value)) {
        return value;
      }
    } catch {
      // localStorage unavailable (SSR, privacy mode) — ignore
    }
    return null;
  }

  private detectBrowserLanguage(): SupportedLang | null {
    if (typeof navigator === 'undefined') return null;

    const raw = navigator.language;
    if (!raw) return null;

    // Extract primary subtag (e.g. "nb-NO" → "nb")
    const primary = raw.split('-')[0].toLowerCase();
    return isSupportedLang(primary) ? primary : null;
  }

  private applyLanguage(lang: SupportedLang): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', 'ltr');
  }

  private persistLanguage(lang: SupportedLang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable — silently ignore
    }
  }
}
