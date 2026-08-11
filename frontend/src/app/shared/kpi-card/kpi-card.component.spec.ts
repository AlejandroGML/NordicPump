import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { KpiCardComponent } from './kpi-card.component';

const translateMock = {
  instant: (key: string) => {
    const m: Record<string, string> = {
      'dashboard.trend.up': 'up',
      'dashboard.trend.down': 'down',
      'dashboard.trend.neutral': 'stable',
    };
    return m[key] ?? key;
  },
};

describe('KpiCardComponent', () => {
  function createFixture(overrides: {
    title?: string;
    value?: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    variant?: 'solid' | 'glass';
    clickable?: boolean;
    colorBand?: 'low' | 'mid' | 'high';
  } = {}): ComponentFixture<KpiCardComponent> {
    const f = TestBed.createComponent(KpiCardComponent);
    const c = f.componentInstance;
    if (overrides.title !== undefined) c.title = overrides.title;
    if (overrides.value !== undefined) c.value = overrides.value;
    if (overrides.subtitle !== undefined) c.subtitle = overrides.subtitle;
    if (overrides.trend !== undefined) c.trend = overrides.trend;
    if (overrides.variant !== undefined) c.variant = overrides.variant;
    if (overrides.clickable !== undefined) c.clickable = overrides.clickable;
    if (overrides.colorBand !== undefined) c.colorBand = overrides.colorBand;
    f.detectChanges();
    return f;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent],
      providers: [{ provide: TranslateService, useValue: translateMock }],
    }).compileComponents();
  });

  describe('rendering', () => {
    it('should display title, value, and subtitle', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '14,50 kr',
        subtitle: 'per liter',
        trend: 'down',
      });
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Euro 95');
      expect(el.textContent).toContain('14,50 kr');
      expect(el.textContent).toContain('per liter');
    });

    it('should display value with price styling', () => {
      const fixture = createFixture({ title: 'Euro 95', value: '14,50 kr' });
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      expect(valueEl).toBeTruthy();
      expect(valueEl.className).toContain('price');
    });

    it('should display title with label styling', () => {
      const fixture = createFixture({ title: 'Euro 95', value: '14,50 kr' });
      const titleEl = fixture.nativeElement.querySelector('[data-testid="kpi-title"]');
      expect(titleEl).toBeTruthy();
      expect(titleEl.className).toContain('label');
    });

    it('should not render subtitle or trend when not set', () => {
      const fixture = createFixture({ title: 'Price', value: '100 kr' });
      const el: HTMLElement = fixture.nativeElement;
      const subtitleEl = el.querySelector('[data-testid="kpi-subtitle"]');
      const trendEl = el.querySelector('[data-testid="kpi-trend"]');
      expect(subtitleEl).toBeNull();
      expect(trendEl).toBeNull();
    });

    it('should render subtitle when provided', () => {
      const fixture = createFixture({
        title: 'Diesel',
        value: '19,57 kr',
        subtitle: 'per liter',
      });
      const subtitleEl = fixture.nativeElement.querySelector('[data-testid="kpi-subtitle"]');
      expect(subtitleEl).toBeTruthy();
      expect(subtitleEl?.textContent).toContain('per liter');
    });
  });

  describe('trend indicators', () => {
    it('should show green down arrow for trend="down"', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '14,50 kr',
        trend: 'down',
      });
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeTruthy();
      expect(trendEl?.textContent).toContain('↘');
      expect(trendEl?.className).toContain('down');
    });

    it('should show red up arrow for trend="up"', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '15,00 kr',
        trend: 'up',
      });
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeTruthy();
      expect(trendEl?.textContent).toContain('↗');
      expect(trendEl?.className).not.toContain('down');
    });

    it('should show gray dash for trend="neutral"', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '14,50 kr',
        trend: 'neutral',
      });
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeTruthy();
      expect(trendEl?.textContent?.trim()).toBe('→');
    });

    it('should not render trend for undefined trend', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '14,50 kr',
      });
      const trendEl = fixture.nativeElement.querySelector('[data-testid="kpi-trend"]');
      expect(trendEl).toBeNull();
    });
  });

  describe('card design tokens', () => {
    it('should render as a kpi card', () => {
      const fixture = createFixture({ title: 'Test', value: '1' });
      const card = fixture.nativeElement.querySelector('[data-testid="kpi-card"]');
      expect(card).toBeTruthy();
      expect(card.className).toContain('kpi');
    });

    it('should render with the kpi card styling', () => {
      const fixture = createFixture({ title: 'Test', value: '1' });
      const card = fixture.nativeElement.querySelector('[data-testid="kpi-card"]');
      expect(card).toBeTruthy();
    });

    it('should accept a variant input without breaking', () => {
      const fixture = createFixture({ title: 'Test', value: '1', variant: 'glass' });
      const card = fixture.nativeElement.querySelector('[data-testid="kpi-card"]');
      expect(card).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on the value', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '14,50 kr',
      });
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      const ariaLabel = valueEl?.getAttribute('aria-label');
      expect(ariaLabel).toContain('Euro 95');
      expect(ariaLabel).toContain('14,50 kr');
    });

    it('should be focusable when clickable', () => {
      const fixture = createFixture({
        title: 'Test',
        value: '1',
        clickable: true,
      });
      const card = fixture.nativeElement.querySelector('[data-testid="kpi-card"]');
      expect(card?.getAttribute('tabindex')).toBe('0');
    });

    it('should not be focusable by default', () => {
      const fixture = createFixture({ title: 'Test', value: '1' });
      const card = fixture.nativeElement.querySelector('[data-testid="kpi-card"]');
      expect(card?.getAttribute('tabindex')).toBeNull();
    });
  });

  describe('colorBand input', () => {
    it('should accept a colorBand input without breaking', () => {
      const fixture = createFixture({
        title: 'Euro 95',
        value: '0,95 kr',
        colorBand: 'low',
      });
      const valueEl = fixture.nativeElement.querySelector('[data-testid="kpi-value"]');
      expect(valueEl).toBeTruthy();
    });
  });
});
