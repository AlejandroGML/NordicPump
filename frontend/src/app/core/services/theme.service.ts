import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Theme state: system / light / dark.
 *
 * - Persists preference in localStorage
 * - Applies `data-theme` on <html> (light/dark resolved from system when "system")
 * - Chart instances read the CSS variables, so they pick up changes automatically
 *   via ChartConfigService helpers
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.loadPreference());

  constructor() {
    // Apply immediately on construction so the theme attribute is set before first paint
    this.apply(this.theme());
    effect(() => this.apply(this.theme()));
    // Follow system changes while in "system" mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme() === 'system') this.apply('system');
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    // Apply immediately (effects are lazy in tests and on first load)
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable (private mode / tests) — session-only is fine
    }
  }

  /** Resolve the effective theme (dark/light) for the current preference. */
  isDark(): boolean {
    return this.resolve(this.theme()) === 'dark';
  }

  private loadPreference(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    } catch {
      return 'system';
    }
  }

  private resolve(pref: Theme): 'light' | 'dark' {
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
  }

  private apply(pref: Theme): void {
    const resolved = this.resolve(pref);
    document.documentElement.dataset['theme'] = resolved;
  }
}
