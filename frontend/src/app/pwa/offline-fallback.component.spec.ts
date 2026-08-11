/**
 * OfflineFallbackComponent Tests — CRITICAL #4 fix
 *
 * Spec: pwa-setup > SW stale-while-revalidate
 *   - Offline no cache → fallback page
 *   - "You're offline. Some features may be unavailable."
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { OfflineFallbackComponent } from './offline-fallback.component';

/**
 * Mock TranslateService that resolves keys to readable test strings.
 */
const translateMock = {
  instant: (key: string) => {
    const map: Record<string, string> = {
      'pwa.offline.title': "You're offline",
      'pwa.offline.description': 'Some features may be unavailable. Please check your internet connection and try again.',
      'pwa.offline.retry': 'Try Again',
    };
    return map[key] ?? key;
  },
  get: (key: string, ..._args: unknown[]) => ({ subscribe: (fn: (v: string) => void) => fn(translateMock.instant(key)) }),
  translate: (key: string, ..._args: unknown[]) => ({ subscribe: (fn: (v: string) => void) => fn(translateMock.instant(key)) }),
  stream: (key: string, ..._args: unknown[]) => ({ subscribe: (fn: (v: string) => void) => fn(translateMock.instant(key)) }),
  use: () => {},
  currentLang: 'en',
  onLangChange: { subscribe: () => {} },
  onTranslationChange: { subscribe: () => {} },
  onDefaultLangChange: { subscribe: () => {} },
};

describe('OfflineFallbackComponent', () => {
  let fixture: ComponentFixture<OfflineFallbackComponent>;
  let component: OfflineFallbackComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineFallbackComponent],
      providers: [{ provide: TranslateService, useValue: translateMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineFallbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the offline message', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("You're offline");
  });

  it('should render a helpful description', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'check your internet connection',
    );
  });

  it('should have a "Try Again" button', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Try Again');
  });

  it('should call window.location.reload on retry', () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    // jsdom doesn't allow full location mocking, so we use Object.defineProperty
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    component.retry();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('should have a cloud-offline SVG icon for visual cue', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('should use the accent color for the icon', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    const classAttr = svg.getAttribute('class') || '';
    expect(classAttr).toContain('text-accent');
  });

  it('should have main landmark with centered layout', () => {
    const main = fixture.nativeElement.querySelector('main');
    expect(main).toBeTruthy();
    expect(main.className).toContain('flex');
    expect(main.className).toContain('items-center');
    expect(main.className).toContain('justify-center');
  });
});
