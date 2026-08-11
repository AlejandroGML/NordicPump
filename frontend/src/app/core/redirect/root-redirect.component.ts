import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../services/lang.service';

/**
 * RootRedirect — detects the user's preferred language and redirects.
 *
 * Spec: i18n-setup > Route-Prefixed URLs
 *   - Root / → runs detection chain → /{lang}/dashboard
 *
 * Uses LanguageService.initLanguage() for the detection chain:
 * localStorage('lang') → navigator.language → 'sv'
 */
@Component({
  selector: 'app-root-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class RootRedirectComponent {
  constructor() {
    const langService = inject(LanguageService);
    const router = inject(Router);

    const lang = langService.initLanguage();
    router.navigate(['/' + lang + '/dashboard']);
  }
}
