import { inject } from '@angular/core';
import {
  type CanActivateChildFn,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { LanguageService } from '../services/lang.service';
import { isSupportedLang } from '../models/lang';

/**
 * Route guard that validates the :lang route parameter.
 *
 * Spec: i18n-setup > Route-Prefixed URLs
 * - Validates :lang param is one of 6 supported
 * - Redirects invalid lang prefix to /{detected-lang}/...rest
 * - Sets language in translate service on route activation
 *
 * Usage:
 *   { path: ':lang', canActivateChild: [LanguageGuard], children: [...] }
 */
export const LanguageGuard: CanActivateChildFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
) => {
  const router = inject(Router);
  const langService = inject(LanguageService);

  const lang = route.paramMap.get('lang');

  if (lang && isSupportedLang(lang)) {
    if (langService.getCurrentLanguage() !== lang) {
      langService.setLanguage(lang);
    }
    return true;
  }

  // Invalid or missing lang — redirect to detected language
  const detected = langService.initLanguage();
  const urlSegments = route.url.map((s) => s.path);

  // Reconstruct URL: replace first segment (the invalid lang) with detected
  const rest =
    urlSegments.length > 1
      ? '/' + urlSegments.slice(1).join('/')
      : '/dashboard';

  return router.createUrlTree([detected + rest]);
};
