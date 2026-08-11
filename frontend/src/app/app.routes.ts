import { Routes } from '@angular/router';
import { LanguageGuard } from './core/guards/lang.guard';
import { RootRedirectComponent } from './core/redirect/root-redirect.component';

/**
 * NordicPump route configuration.
 *
 * Spec: i18n-setup > Route-Prefixed URLs
 * - All feature routes use /:lang/ prefix
 * - Root / → detection chain → /{lang}/dashboard
 * - Invalid lang → redirect to detected lang
 */
export const routes: Routes = [
  {
    path: ':lang',
    canActivateChild: [LanguageGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/about.component').then(
            (m) => m.AboutComponent,
          ),
      },
      {
        path: 'offline',
        loadComponent: () =>
          import('./pwa/offline-fallback.component').then(
            (m) => m.OfflineFallbackComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', component: RootRedirectComponent, pathMatch: 'full' },
];
