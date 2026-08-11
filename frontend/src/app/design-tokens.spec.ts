import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Design Token Verification Tests
 *
 * Spec: layout-shell > Tailwind CSS Design Tokens
 * - bg-primary → computed bg is #1E40AF
 * - font-sans → computed font-family includes "Fira Sans"
 *
 * These tests verify the configuration files exist with the correct content.
 * They act as smoke tests for the Tailwind v4 + PostCSS setup.
 */

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');
const SRC_DIR = resolve(import.meta.dirname, '..');

describe('Tailwind v4 Configuration', () => {
  describe('.postcssrc.json', () => {
    it('should exist at project root', () => {
      const exists = existsSync(resolve(PROJECT_ROOT, '.postcssrc.json'));
      expect(exists).toBe(true);
    });

    it('should contain @tailwindcss/postcss plugin', () => {
      const config = JSON.parse(
        readFileSync(resolve(PROJECT_ROOT, '.postcssrc.json'), 'utf-8'),
      );
      expect(config.plugins).toBeDefined();
      expect(config.plugins['@tailwindcss/postcss']).toBeDefined();
    });
  });

  describe('styles.css — Design Tokens (@theme block)', () => {
    let stylesContent: string;

    beforeAll(() => {
      stylesContent = readFileSync(resolve(SRC_DIR, 'styles.css'), 'utf-8');
    });

    it('should import tailwindcss', () => {
      expect(stylesContent).toContain('@import "tailwindcss"');
    });

    it('should note Google Fonts CDN strategy in comments', () => {
      expect(stylesContent).toContain('Google Fonts CDN');
    });

    it('should load Fira Sans (400, 500, 600) and Fira Code (500) via Google Fonts in index.html', () => {
      const indexPath = resolve(SRC_DIR, 'index.html');
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('fonts.googleapis.com');
      expect(html).toContain('Fira+Sans:wght@400;500;600');
      expect(html).toContain('Fira+Code:wght@500');
      expect(html).toContain('display=swap');
    });

    it('should define @theme block', () => {
      expect(stylesContent).toContain('@theme');
    });

    // DESIGN.md color tokens
    it('should map --color-primary to #1E40AF', () => {
      expect(stylesContent).toMatch(
        /--color-primary\s*:\s*#1E40AF\b/,
      );
    });

    it('should map --color-secondary to #3B82F6', () => {
      expect(stylesContent).toMatch(
        /--color-secondary\s*:\s*#3B82F6\b/,
      );
    });

    it('should map --color-accent to #F59E0B', () => {
      expect(stylesContent).toMatch(
        /--color-accent\s*:\s*#F59E0B\b/,
      );
    });

    it('should map --color-background to #F8FAFC', () => {
      expect(stylesContent).toMatch(
        /--color-background\s*:\s*#F8FAFC\b/,
      );
    });

    it('should map --color-text to #1E3A8A', () => {
      expect(stylesContent).toMatch(
        /--color-text\s*:\s*#1E3A8A\b/,
      );
    });

    // Typography tokens
    it('should map --font-body to Fira Sans', () => {
      expect(stylesContent).toMatch(
        /--font-body\s*:\s*['"]Fira Sans['"],?\s*sans-serif/,
      );
    });

    it('should map --font-mono to Fira Code', () => {
      expect(stylesContent).toMatch(
        /--font-mono\s*:\s*['"]Fira Code['"],?\s*monospace/,
      );
    });

    // WCAG AA accessibility — accent-on-dark (required by DESIGN.md)
    it('should map --color-on-accent to #1E3A8A (WCAG AA safe)', () => {
      expect(stylesContent).toMatch(
        /--color-on-accent\s*:\s*#1E3A8A\b/,
      );
    });

    // Spacing scale
    it('should define --spacing-4 (16px) from DESIGN.md spacing scale', () => {
      expect(stylesContent).toMatch(/--spacing-4\s*:\s*16px/);
    });

    it('should define --spacing-8 (32px) from DESIGN.md spacing scale', () => {
      expect(stylesContent).toMatch(/--spacing-8\s*:\s*32px/);
    });

    // Radius scale (redesign: sm=10px rounded controls, lg=14px cards)
    it('should define --radius-md (10px) from redesign rounded scale', () => {
      expect(stylesContent).toMatch(/--radius-md\s*:\s*10px/);
    });

    // Global reset
    it('should include box-sizing: border-box reset', () => {
      expect(stylesContent).toContain('box-sizing: border-box');
    });
  });
});
