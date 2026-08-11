import { Component, inject, signal, HostListener, ElementRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/services/lang.service';
import { ThemeSwitcherComponent } from '@shared/theme-switcher/theme-switcher.component';
import { CurrencySwitcherComponent } from '@shared/currency-switcher/currency-switcher.component';
import { LanguageSwitcherComponent } from '@shared/language-switcher/language-switcher.component';
import type { SupportedLang } from '@core/models/lang';

/**
 * Application header — topbar with brand mark, online indicator, and
 * language and theme controls.
 *
 * Design: nordicpump-redesign.html → .topbar
 * - Brand mark "NP" + NordicPump + subtitle
 * - Online indicator ("Datos sincronizados")
 * - Language select + circular theme toggle (prototype)
 * - Mobile: hamburger + slide-out drawer
 */
@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    ThemeSwitcherComponent,
    LanguageSwitcherComponent,
    CurrencySwitcherComponent,
  ],
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: 50; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 76px;
      border-bottom: 1px solid var(--color-hairline);
      gap: 18px;
      padding: 0 22px;
      background: var(--color-background);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--color-text);
      text-decoration: none;
      min-height: 44px;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font: 700 16px 'Fira Code', monospace;
    }
    .brand strong { display: block; font-size: 17px; letter-spacing: -.02em; }
    .brand small { display: block; color: var(--color-text-subtle); font-size: 11px; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .online {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--color-text-muted);
      font-size: 12px;
    }
    .online::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--color-chart-low);
      border-radius: 50%;
    }
    .online.offline::before { background: var(--color-chart-high); }
    .mobile-menu {
      border-top: 1px solid var(--color-hairline);
      padding: 12px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    /* Hamburger: hidden on desktop, shown on mobile */
    .menu-toggle { display: none; }
    @media (max-width: 680px) {
      .topbar { min-height: 66px; padding: 0 14px; }
      .online { display: none; }
      .top-actions { display: none; } /* controls live in the drawer on mobile */
      .menu-toggle { display: inline-flex; }
    }
  `],
  template: `
    <header role="banner" style="position: sticky; top: 0; z-index: 50; background: var(--color-background);">
      <div class="topbar">
        <a class="brand" [routerLink]="dashboardLink">
          <span class="brand-mark" aria-hidden="true">NP</span>
          <span>
            <strong>NordicPump</strong>
            <small>{{ 'app.subtitle' | translate }}</small>
          </span>
        </a>

        <div class="top-actions">
          <span class="online" [class.offline]="!online()">
            {{ online() ? ('header.online' | translate) : ('header.offline' | translate) }}
          </span>
          <app-language-switcher />
          <app-currency-switcher />
          <app-theme-switcher />
        </div>

        <!-- Mobile: hamburger -->
        <button
          class="menu-toggle md:hidden p-3 rounded-md hover:bg-surface-muted transition-colors min-w-[44px] min-h-[44px]"
          [attr.aria-label]="menuOpen ? 'Close menu' : 'Open menu'"
          [attr.aria-expanded]="menuOpen"
          (click)="toggleMenu()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            @if (menuOpen) {
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            } @else {
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            }
          </svg>
        </button>
      </div>

      <!-- Mobile: slide-out drawer -->
      @if (menuOpen) {
        <div class="mobile-menu" role="navigation" aria-label="Mobile navigation">
          <a
            [routerLink]="dashboardLink"
            class="block text-text hover:text-accent transition-colors duration-150 text-body-sm no-underline py-2 min-h-[44px]"
            (click)="closeMenu()"
          >
            {{ 'nav.dashboard' | translate }}
          </a>
          <app-language-switcher />
          <app-currency-switcher />
          <app-theme-switcher />
        </div>
      }
    </header>
  `,
})
export class HeaderComponent implements OnDestroy {
  private readonly langService = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  protected menuOpen = false;

  /** Reactive online/offline state. */
  protected readonly online = signal(navigator.onLine);

  private readonly onlineHandler = () => this.online.set(true);
  private readonly offlineHandler = () => this.online.set(false);

  protected get language(): SupportedLang {
    return this.langService.getCurrentLanguage();
  }

  protected get dashboardLink(): string[] {
    return ['/', this.language, 'dashboard'];
  }

  constructor() {
    this.router.events.subscribe(() => {
      this.menuOpen = false;
    });
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) this.menuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent): void {
    if (this.menuOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.menuOpen = false;
    }
  }
}
