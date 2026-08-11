import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService, type Theme } from '@core/services/theme.service';

/**
 * Theme toggle — circular button (moon/sun icons), prototype: nordicpump-redesign.html → .theme-toggle.
 *
 * Toggles between light and dark based on the currently resolved theme.
 * The initial preference (system/light/dark) is read from localStorage by
 * ThemeService; tapping alternates dark ↔ light (persisted).
 */
@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [attr.aria-label]="ariaLabel"
      [attr.aria-pressed]="isDark"
      (click)="toggle()"
    >
      <svg class="theme-icon moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
      </svg>
      <svg class="theme-icon sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  `,
  styles: [`
    .theme-toggle {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: 1px solid var(--color-hairline-strong);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
      transition: border-color 150ms ease, color 150ms ease, transform 100ms ease;
    }
    .theme-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); transform: translateY(-1px); }
    .theme-toggle:active { transform: translateY(1px); }
    .theme-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .theme-icon.sun { display: none; }
    [data-theme="dark"] .theme-icon.moon { display: none; }
    [data-theme="dark"] .theme-icon.sun { display: block; }
  `],
})
export class ThemeSwitcherComponent {
  private readonly themeService = inject(ThemeService);

  protected get isDark(): boolean {
    return this.themeService.isDark();
  }

  protected get ariaLabel(): string {
    return this.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  }

  protected toggle(): void {
    const next: Theme = this.isDark ? 'light' : 'dark';
    this.themeService.setTheme(next);
  }
}
