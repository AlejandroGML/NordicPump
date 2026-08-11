import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThemeService, type Theme } from './theme.service';

/** localStorage may be unavailable in this test env — stub it. */
function storage(): Storage {
  return {
    getItem: (k: string) => (globalThis as Record<string, unknown>)[`__storage_${k}`] as string | null ?? null,
    setItem: (k: string, v: string) => { (globalThis as Record<string, unknown>)[`__storage_${k}`] = v; },
    removeItem: (k: string) => { delete (globalThis as Record<string, unknown>)[`__storage_${k}`]; },
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

describe('ThemeService', () => {
  let service: ThemeService;
  let origStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Provide a working localStorage stub before the service is injected
    origStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { value: storage(), configurable: true });
    document.documentElement.removeAttribute('data-theme');
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    if (origStorage) Object.defineProperty(window, 'localStorage', origStorage);
  });

  it('should default to system', () => {
    expect(service.theme()).toBe('system');
  });

  it('should apply a data-theme attribute on <html>', () => {
    service.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    service.setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should persist the preference in localStorage', () => {
    service.setTheme('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('should load a saved preference', () => {
    window.localStorage.setItem('theme', 'light');
    TestBed.resetTestingModule();
    const svc = TestBed.inject(ThemeService);
    expect(svc.theme()).toBe('light');
  });

  it('should resolve system preference to a concrete theme', () => {
    service.setTheme('system');
    expect(typeof service.isDark()).toBe('boolean');
  });

  it('should not crash when localStorage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true });
    const svc = TestBed.inject(ThemeService);
    expect(svc.theme()).toBe('system');
    svc.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
