#!/usr/bin/env node

/**
 * Generate PWA PNG icons from the SVG source.
 *
 * Renders the branded SVG (blue rounded square, white pump icon, "NP" text)
 * into 192×192 and 512×512 PNG icons using sharp.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * Spec: pwa-setup > Web App Manifest — icons 192×192 and 512×512
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ICONS_DIR = resolve(__dirname, '..', 'public', 'icons');
const SVG_PATH = resolve(ICONS_DIR, 'icon.svg');

async function generate() {
  const svg = readFileSync(SVG_PATH);

  for (const size of [192, 512]) {
    const png = await sharp(svg)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    writeFileSync(resolve(ICONS_DIR, `icon-${size}.png`), png);
    console.log(`  ✓ icon-${size}.png (${png.length} bytes)`);
  }

  console.log('Done.');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
