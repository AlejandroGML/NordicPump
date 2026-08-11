import { describe, it, expect } from 'vitest';
import { Routes } from '@angular/router';
import { routes } from '../app.routes';

/**
 * Spec: i18n-setup > Route-Prefixed URLs
 * - All routes MUST use /:lang/ prefix: /:lang/dashboard
 * - Root / → runs detection chain, redirects to /sv/dashboard
 * - Invalid /de/dashboard → redirects to /sv/dashboard
 *
 * Spec: layout-shell > AppComponent Shell
 * - Root AppComponent MUST contain router-outlet
 */
describe('App Routes — i18n prefix structure', () => {
  it('should have routes defined', () => {
    expect(routes).toBeDefined();
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have :lang parent route', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    expect(langRoute).toBeDefined();
  });

  it(':lang route should have children', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    expect(langRoute?.children).toBeDefined();
    expect(langRoute!.children!.length).toBeGreaterThan(0);
  });

  it('should have dashboard child route under :lang with lazy loading', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    const dashboardRoute = langRoute?.children?.find(
      (r) => r.path === 'dashboard',
    );
    expect(dashboardRoute).toBeDefined();
    expect(dashboardRoute?.loadComponent).toBeDefined();
    expect(typeof dashboardRoute?.loadComponent).toBe('function');
  });

  it('should have root redirect via RootRedirectComponent', () => {
    const rootRoute = routes.find((r) => r.path === '');
    expect(rootRoute).toBeDefined();

    // Root now uses a component that detects language and redirects
    expect(rootRoute?.component).toBeDefined();
    expect(rootRoute?.pathMatch).toBe('full');
    // Import path for RootRedirectComponent
    const rootImportPath = rootRoute?.component?.name;
    // esbuild may prefix class names with `_` in the test bundle
    expect(rootImportPath).toMatch(/RootRedirectComponent$/);
  });

  it('should have empty path redirect to dashboard under :lang', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    const emptyChild = langRoute?.children?.find((r) => r.path === '');
    expect(emptyChild).toBeDefined();
    expect(emptyChild?.redirectTo).toBe('dashboard');
    expect(emptyChild?.pathMatch).toBe('full');
  });

  it('should NOT have direct /dashboard route (without lang prefix)', () => {
    const directDashboard = routes.find((r) => r.path === 'dashboard');
    expect(directDashboard).toBeUndefined();
  });

  it('should have about child route under :lang with lazy loading', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    const aboutRoute = langRoute?.children?.find((r) => r.path === 'about');
    expect(aboutRoute).toBeDefined();
    expect(aboutRoute?.loadComponent).toBeDefined();
    expect(typeof aboutRoute?.loadComponent).toBe('function');
  });

  it('should have offline child route under :lang with lazy loading', () => {
    const langRoute = routes.find((r) => r.path === ':lang');
    const offlineRoute = langRoute?.children?.find((r) => r.path === 'offline');
    expect(offlineRoute).toBeDefined();
    expect(offlineRoute?.loadComponent).toBeDefined();
    expect(typeof offlineRoute?.loadComponent).toBe('function');
  });
});
