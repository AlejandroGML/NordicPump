import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * About page — simple informational page about NordicPump.
 *
 * Spec: layout-shell > Route /:lang/about
 * - Standalone component rendered at /:lang/about
 * - Shows app name and brief description via i18n keys
 */
@Component({
  selector: 'app-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <article class="max-w-2xl mx-auto py-8 px-4">
      <h1 class="text-display text-text mb-4">{{ 'about.title' | translate }}</h1>
      <p class="text-body-lg text-text-muted leading-relaxed">
        {{ 'about.description' | translate }}
      </p>
    </article>
  `,
})
export class AboutComponent {}
