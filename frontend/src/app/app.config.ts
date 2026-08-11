import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

/**
 * NordicPump application-wide providers.
 *
 * i18n: @ngx-translate v18 uses zero-arg TranslateHttpLoader +
 *       provideTranslateHttpLoader({ prefix, suffix }) for configuration.
 *       The old 3-arg constructor (http, prefix, suffix) is removed.
 *
 * PWA: Service worker registered with registerWhenStable:30000 in non-dev mode.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    provideTranslateService({
      lang: 'sv',
      fallbackLang: 'sv',
    }),
    provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
