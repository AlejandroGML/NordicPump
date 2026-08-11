import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonLoaderComponent } from './skeleton-loader.component';

/**
 * Spec: dashboard-core > skeleton-loader
 *
 * NOTE: Angular's change detection in this Vitest setup does not re-evaluate
 * template bindings for @Input() properties set after the initial render.
 * Each test that needs different input values creates a fresh component
 * and sets properties BEFORE the first detectChanges().
 */
describe('SkeletonLoaderComponent', () => {
  let originalMatchMedia: typeof window.matchMedia;

  function createFixture(
    overrides: Partial<{
      variant: 'text' | 'card' | 'circle';
      width: string;
      height: string;
      rounded: string;
      label: string;
    }> = {},
  ): ComponentFixture<SkeletonLoaderComponent> {
    const f = TestBed.createComponent(SkeletonLoaderComponent);
    const c = f.componentInstance;
    if (overrides.variant !== undefined) c.variant = overrides.variant;
    if (overrides.width !== undefined) c.width = overrides.width;
    if (overrides.height !== undefined) c.height = overrides.height;
    if (overrides.rounded !== undefined) c.rounded = overrides.rounded;
    if (overrides.label !== undefined) c.label = overrides.label;
    f.detectChanges();
    return f;
  }

  function getSkeleton(fixture: ComponentFixture<SkeletonLoaderComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="skeleton"]');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonLoaderComponent],
    }).compileComponents();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe('default rendering (text variant)', () => {
    it('should render the skeleton element', () => {
      const fixture = createFixture();
      const el = getSkeleton(fixture);
      expect(el).toBeTruthy();
    });

    it('should default to full-width 20px height, rounded-md (8px)', () => {
      const fixture = createFixture();
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('100%');
      expect(el.style.height).toBe('20px');
      expect(el.style.borderRadius).toBe('8px');
    });

    it('should have role="status" and aria-busy="true"', () => {
      const fixture = createFixture();
      const el = fixture.nativeElement.querySelector('[role="status"]');
      expect(el).toBeTruthy();
      expect(el!.getAttribute('aria-busy')).toBe('true');
    });

    it('should show default "Loading..." label when none provided', () => {
      const fixture = createFixture();
      const label = fixture.nativeElement.querySelector('.sr-only');
      expect(label?.textContent?.trim()).toBe('Loading...');
    });

    it('should show custom label when provided', () => {
      const fixture = createFixture({ label: 'Laddar priser...' });
      const label = fixture.nativeElement.querySelector('.sr-only');
      expect(label?.textContent?.trim()).toBe('Laddar priser...');
    });

    it('should have animate-pulse class by default', () => {
      const fixture = createFixture();
      const el = getSkeleton(fixture);
      expect(el.className).toContain('animate-pulse');
    });
  });

  describe('card variant', () => {
    it('should render at 240×160px with rounded-lg (12px)', () => {
      const fixture = createFixture({ variant: 'card' });
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('240px');
      expect(el.style.height).toBe('160px');
      expect(el.style.borderRadius).toBe('12px');
    });

    it('should contain 3 internal placeholder lines', () => {
      const fixture = createFixture({ variant: 'card' });
      const lines = fixture.nativeElement.querySelectorAll('[data-testid="skeleton-line"]');
      expect(lines.length).toBe(3);
    });
  });

  describe('circle variant', () => {
    it('should render at 48×48px with rounded-full (9999px)', () => {
      const fixture = createFixture({ variant: 'circle' });
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('48px');
      expect(el.style.height).toBe('48px');
      expect(el.style.borderRadius).toBe('9999px');
    });

    it('should not render internal placeholder lines', () => {
      const fixture = createFixture({ variant: 'circle' });
      const lines = fixture.nativeElement.querySelectorAll('[data-testid="skeleton-line"]');
      expect(lines.length).toBe(0);
    });
  });

  describe('custom dimensions override variants', () => {
    it('should apply custom width/height overriding text defaults', () => {
      const fixture = createFixture({ width: '200px', height: '48px' });
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('200px');
      expect(el.style.height).toBe('48px');
    });

    it('should apply custom width/height overriding card defaults', () => {
      const fixture = createFixture({ variant: 'card', width: '400px', height: '200px' });
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('400px');
      expect(el.style.height).toBe('200px');
    });

    it('should apply rounded="full" when set explicitly', () => {
      const fixture = createFixture({ rounded: 'full' });
      const el = getSkeleton(fixture);
      expect(el.style.borderRadius).toBe('9999px');
    });
  });

  describe('prefers-reduced-motion', () => {
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    });

    it('should disable pulse animation when reduced motion is active', () => {
      const fixture = createFixture();
      const el = getSkeleton(fixture);
      expect(el.className).not.toContain('animate-pulse');
    });

    it('should still render correct dimensions when animation is disabled', () => {
      const fixture = createFixture({ variant: 'card', width: '300px', height: '120px' });
      const el = getSkeleton(fixture);
      expect(el.style.width).toBe('300px');
      expect(el.style.height).toBe('120px');
    });
  });
});
