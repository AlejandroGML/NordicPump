import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { FreshnessBannerComponent } from './pwa/freshness-banner.component';
import { InstallPromptComponent } from './pwa/install-prompt.component';
import { LanguageService } from './core/services/lang.service';

/**
 * Root application component — layout shell.
 *
 * Spec: layout-shell > AppComponent Shell
 * - Layout structure: header + <router-outlet> + footer
 * - Responsive container: max-w-7xl mx-auto px-4
 * - Set lang attribute on <html> from LanguageService
 * - Sticky footer pattern (flex-col + min-h-screen + mt-auto on footer)
 *
 * Spec: i18n-setup > Language Detection Chain
 * - Fonts: Fira Sans + Fira Code loaded in styles.css
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, FreshnessBannerComponent, InstallPromptComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-background">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        Skip to main content
      </a>

      <app-install-prompt />
      <app-freshness-banner />
      <app-header />

      <main id="main-content" class="max-w-7xl mx-auto px-4 w-full flex-1 py-6">
        <router-outlet />
      </main>

      <app-footer />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class App implements OnInit {
  private readonly langService = inject(LanguageService);

  ngOnInit(): void {
    // Initialize language detection and set html[lang] attribute.
    // LanguageService.initLanguage() runs the detection chain:
    //   localStorage('lang') → navigator.language → 'sv' fallback
    // and sets document.documentElement.lang + dir attributes.
    this.langService.initLanguage();
  }
}
