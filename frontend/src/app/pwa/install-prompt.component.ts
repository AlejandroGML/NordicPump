import { Component, OnInit, OnDestroy, HostListener, inject, signal, afterRenderEffect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

/**
 * Install Prompt — PWA installation banner.
 *
 * Spec: pwa-setup > Install Prompt UX
 * - Detects `beforeinstallprompt` event on window
 * - Shows a banner with "Install NordicPump" button
 * - On install click: calls event.prompt(), then hides
 * - On dismiss: hides for session
 * - Suppressed if app is already installed (display-mode: standalone)
 * - aria-live="polite" region for screen reader announcements
 * - Respects `prefers-reduced-motion`
 */
@Component({
  selector: 'app-install-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (showBanner()) {
      <!-- Compact floating chip — bottom-right (Android download pattern).
           Sits ABOVE content, never blocks the tank calculator mid-page. -->
      <aside
        data-testid="install-banner"
        class="fixed bottom-4 right-4 z-50 bg-surface text-text rounded-lg shadow-xl
               border border-hairline p-4 pr-10 max-w-[320px]
               motion-safe:animate-slide-up"
        [class.motion-safe:animate-slide-up]="!prefersReducedMotion()"
        role="complementary"
      >
        <!-- Close (X) — absolute top-right corner -->
        <button
          data-testid="dismiss-button"
          class="absolute top-2 right-2 w-8 h-8 inline-flex items-center justify-center
                 rounded-md text-text-subtle hover:text-text hover:bg-surface-muted
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-secondary transition-colors"
          [attr.aria-label]="translate.instant('pwa.install.ariaDismiss')"
          (click)="dismiss()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div class="flex items-start gap-3">
          <!-- App/install icon -->
          <div class="shrink-0 w-10 h-10 rounded-md bg-primary text-on-primary
                      inline-flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="12" y1="18" x2="12" y2="18" />
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-text leading-snug mb-2">
              {{ translate.instant('pwa.install.message') }}
            </p>
            <button
              data-testid="install-button"
              class="w-full bg-primary text-on-primary px-3 py-2 rounded-md
                     font-semibold text-sm hover:bg-primary-hover
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-secondary transition-colors min-h-[36px]"
              [attr.aria-label]="translate.instant('pwa.install.ariaInstall')"
              (click)="install()"
            >
              {{ translate.instant('pwa.install.button') }}
            </button>
          </div>
        </div>
      </aside>
    }

    <!-- Screen reader live region for install availability announcements -->
    <div aria-live="polite" class="sr-only">
      @if (showBanner()) {
        {{ translate.instant('pwa.install.srAnnouncement') }}
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      @keyframes slide-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: translateY(0);
        }
      }

      .motion-safe\\:animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
    `,
  ],
})
export class InstallPromptComponent implements OnInit, OnDestroy {
  protected readonly translate = inject(TranslateService);

  /** Whether the install banner is currently visible */
  readonly showBanner = signal(false);

  /** Whether user prefers reduced motion */
  readonly prefersReducedMotion = signal(false);

  /**
   * Keep page content clear of the fixed bottom banner:
   * pad <body> by the banner's real height while it is visible,
   * so the tank calculator slider is never hidden behind it.
   */
  private readonly padBodyForBanner = afterRenderEffect(() => {
    if (this.showBanner()) {
      const banner = document.querySelector<HTMLElement>(
        '[data-testid="install-banner"]',
      );
      const height = banner?.getBoundingClientRect().height ?? 0;
      document.body.style.paddingBottom = `${height + 8}px`;
    } else {
      document.body.style.paddingBottom = '';
    }
  });

  /** Stored BeforeInstallPromptEvent for later use */
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  /** Whether the user has dismissed the banner this session */
  private dismissedThisSession = false;

  ngOnInit(): void {
    this.checkReducedMotion();
    this.checkAlreadyInstalled();
  }

  ngOnDestroy(): void {
    // Clean up body padding in case the banner was still visible
    document.body.style.paddingBottom = '';
    // HostListener cleans up automatically — no manual removal needed
  }

  /**
   * Check prefers-reduced-motion media query.
   */
  private checkReducedMotion(): void {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion.set(mq.matches);
  }

  /**
   * Check if app is already installed via display-mode.
   * If standalone, suppress the prompt permanently.
   */
  private checkAlreadyInstalled(): void {
    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.matches) {
      // Already installed — never show the prompt
      return;
    }

    // Also listen for changes (unlikely but correct)
    mq.addEventListener('change', (e) => {
      if (e.matches) {
        this.showBanner.set(false);
        this.deferredPrompt = null;
      }
    });
  }

  /**
   * Handler bound as arrow function via @HostListener.
   * Suppresses the default mini-infobar and shows the custom banner.
   */
  @HostListener('window:beforeinstallprompt', ['$event'])
  private onBeforeInstallPrompt = (event: Event): void => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    if (this.dismissedThisSession) {
      return;
    }

    // Prevent the default mini-infobar from appearing
    event.preventDefault();

    // Store the event for later use
    this.deferredPrompt = event as BeforeInstallPromptEvent;

    // Show the install banner
    this.showBanner.set(true);
  };

  /**
   * User clicks Install — trigger the native PWA dialog.
   */
  async install(): Promise<void> {
    if (!this.deferredPrompt) return;

    try {
      await this.deferredPrompt.prompt();

      const choice = await this.deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        // User installed — permanently hide
        this.deferredPrompt = null;
        this.showBanner.set(false);
      }
    } catch (err) {
      console.error('PWA install failed', err);
      this.deferredPrompt = null;
      this.showBanner.set(false);
    }
  }

  /**
   * User clicks "Not now" — hide for session.
   */
  dismiss(): void {
    this.dismissedThisSession = true;
    this.showBanner.set(false);
  }
}
