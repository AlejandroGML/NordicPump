import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';
import { provideTranslateService } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageGuard } from './lang.guard';
import { LanguageService } from '../services/lang.service';

/**
 * Spec: i18n-setup > Route-Prefixed URLs
 * - Redirect / to /{detected-lang}/dashboard
 * - Validate :lang param is one of 6 supported
 * - Redirect invalid lang prefix to /{detected-lang}/...rest
 * - Set language in translate service on route activation
 */

@Component({ template: '<h1>Dashboard</h1>' })
class DashboardStub {}

describe('LanguageGuard', () => {
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    // Mock localStorage to sv for consistent redirects
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => (key === 'lang' ? null : null),
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

    // Mock navigator to sv (jsdom defines `language` on the instance,
    // so spy directly on window.navigator rather than the prototype)
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'sv-SE',
    });

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideTranslateService({
          lang: 'sv',
        }),
        LanguageService,
        provideRouter([
          { path: '', redirectTo: '/sv/dashboard', pathMatch: 'full' },
          {
            path: ':lang',
            canActivateChild: [LanguageGuard],
            children: [
              { path: 'dashboard', component: DashboardStub },
              { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            ],
          },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  describe('canActivateChild — valid prefixes', () => {
    it.each(['sv', 'da', 'nb', 'fi', 'en', 'es'])(
      'should allow valid language prefix %s',
      async (lang) => {
        await router.navigate([`/${lang}/dashboard`]);
        expect(location.path()).toBe(`/${lang}/dashboard`);
      },
    );
  });

  describe('canActivateChild — invalid prefixes', () => {
    it('should redirect invalid language prefix to detected language', async () => {
      await router.navigate(['/de/dashboard']);
      expect(location.path()).toBe('/sv/dashboard');
    });

    it('should redirect unsupported two-char code to detected language', async () => {
      await router.navigate(['/fr/dashboard']);
      expect(location.path()).toBe('/sv/dashboard');
    });
  });

  describe('root redirect', () => {
    it('should redirect / to /sv/dashboard', async () => {
      await router.navigate(['/']);
      expect(location.path()).toBe('/sv/dashboard');
    });
  });
});
