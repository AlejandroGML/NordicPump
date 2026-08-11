/**
 * PWA Manifest & Index.html Tests — Task 4.1 & 4.2
 *
 * Spec: pwa-setup > Web App Manifest
 *   - Valid manifest.webmanifest with required fields
 *   - theme_color #1E40AF, bg #F8FAFC, display standalone, scope /
 *   - start_url /sv/dashboard, icons 192x192 + 512x512
 *   - index.html: manifest link, theme-color meta, apple-touch-icon
 *
 * Spec: pwa-setup > Manifest missing icon sizes
 *   - Missing 512×512 icon → PWA installability fails
 *
 * Spec: pwa-setup > Splash Screen
 *   - Icons support maskable purpose for splash screen
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC_DIR = resolve(__dirname, '../../../public');
const SRC_DIR = resolve(__dirname, '../../');

describe('PWA Manifest (4.1)', () => {
  const manifestPath = resolve(PUBLIC_DIR, 'manifest.webmanifest');

  it('should have a manifest.webmanifest file in public/', () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it('should be valid JSON', () => {
    const raw = readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  describe('required fields', () => {
    function getManifest(): any {
      const raw = readFileSync(manifestPath, 'utf-8');
      return JSON.parse(raw);
    }

    it('should have name "NordicPump — Fuel Price Comparison"', () => {
      const m = getManifest();
      expect(m.name).toBe('NordicPump — Fuel Price Comparison');
    });

    it('should have short_name "NordicPump"', () => {
      const m = getManifest();
      expect(m.short_name).toBe('NordicPump');
    });

    it('should have description', () => {
      const m = getManifest();
      expect(m.description).toBe(
        'Compare fuel prices across Sweden, Denmark, Finland, and Norway',
      );
    });

    it('should have start_url "/"', () => {
      const m = getManifest();
      expect(m.start_url).toBe('/');
    });

    it('should have scope "/"', () => {
      const m = getManifest();
      expect(m.scope).toBe('/');
    });

    it('should have display "standalone"', () => {
      const m = getManifest();
      expect(m.display).toBe('standalone');
    });

    it('should have theme_color "#1E40AF"', () => {
      const m = getManifest();
      expect(m.theme_color).toBe('#1E40AF');
    });

    it('should have background_color "#F8FAFC"', () => {
      const m = getManifest();
      expect(m.background_color).toBe('#F8FAFC');
    });

    it('should have lang "sv"', () => {
      const m = getManifest();
      expect(m.lang).toBe('sv');
    });

    it('should have dir "ltr"', () => {
      const m = getManifest();
      expect(m.dir).toBe('ltr');
    });

    it('should allow any orientation', () => {
      const m = getManifest();
      expect(m.orientation).toBe('any');
    });

    describe('icons', () => {
      it('should have an icons array with at least 2 entries', () => {
        const m = getManifest();
        expect(Array.isArray(m.icons)).toBe(true);
        expect((m.icons as unknown[]).length).toBeGreaterThanOrEqual(2);
      });

      it('should include a 192×192 icon', () => {
        const m = getManifest();
        const icon192 = (m.icons as Array<any>).find(
          (i) => i.sizes === '192x192',
        );
        expect(icon192).toBeDefined();
        expect(icon192!.src).toBe('/icons/icon-192.png');
        expect(icon192!.type).toBe('image/png');
      });

      it('should include a 512×512 maskable icon', () => {
        const m = getManifest();
        const icon512 = (m.icons as Array<any>).find(
          (i) => i.sizes === '512x512',
        );
        expect(icon512).toBeDefined();
        expect(icon512!.src).toBe('/icons/icon-512.png');
        expect(icon512!.type).toBe('image/png');
        expect(icon512!.purpose).toBe('any maskable');
      });
    });
  });
});

describe('PWA Icon Generation (4.2)', () => {
  it('should have icon-192.png at public/icons/', () => {
    expect(existsSync(resolve(PUBLIC_DIR, 'icons/icon-192.png'))).toBe(true);
  });

  it('should have icon-512.png at public/icons/', () => {
    expect(existsSync(resolve(PUBLIC_DIR, 'icons/icon-512.png'))).toBe(true);
  });

  it('should have icon.svg at public/icons/', () => {
    expect(existsSync(resolve(PUBLIC_DIR, 'icons/icon.svg'))).toBe(true);
  });

  it('should have 192×192 icon that is at least 500 bytes (valid PNG)', () => {
    const icon192 = readFileSync(resolve(PUBLIC_DIR, 'icons/icon-192.png'));
    // A valid PNG must start with the PNG signature
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(icon192.subarray(0, 8)).toEqual(pngSignature);
    expect(icon192.length).toBeGreaterThan(500);
  });

  it('should have 512×512 icon that is at least 1000 bytes (valid PNG)', () => {
    const icon512 = readFileSync(resolve(PUBLIC_DIR, 'icons/icon-512.png'));
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(icon512.subarray(0, 8)).toEqual(pngSignature);
    expect(icon512.length).toBeGreaterThan(1000);
  });
});

describe('index.html PWA meta tags (4.1)', () => {
  const indexPath = resolve(SRC_DIR, 'index.html');
  let html: string;

  function readHtml(): string {
    if (!html) {
      html = readFileSync(indexPath, 'utf-8');
    }
    return html;
  }

  it('should have a manifest link tag', () => {
    const content = readHtml();
    expect(content).toContain('<link rel="manifest"');
    expect(content).toMatch(/href="\/manifest\.webmanifest"/);
  });

  it('should have a theme-color meta tag with #1E40AF', () => {
    const content = readHtml();
    expect(content).toContain('name="theme-color"');
    expect(content).toContain('content="#1E40AF"');
  });

  it('should have an apple-touch-icon link for 192×192', () => {
    const content = readHtml();
    expect(content).toContain('apple-touch-icon');
    expect(content).toMatch(/href="\/icons\/icon-192\.png"/);
  });

  it('should have an apple-touch-icon link for 512×512 (for iPad)', () => {
    const content = readHtml();
    const matches = content.match(/apple-touch-icon/g);
    // At least 2: one for 192, one for 512
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
