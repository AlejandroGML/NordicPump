import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract test: frontend shared models vs backend Pydantic models.
 *
 * Prevents schema drift between frontend/src/app/shared/models/price.ts
 * and backend/models/price.py — the two sides of GET /api/v1/prices/{country}.
 * The backend and frontend cannot share code (different runtimes), so the
 * contract is validated here, mirroring i18n-config.spec.ts.
 */

const FRONTEND_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const BACKEND_PRICE_PATH = resolve(FRONTEND_ROOT, 'backend', 'models', 'price.py');
const BACKEND_COUNTRIES_PATH = resolve(FRONTEND_ROOT, 'backend', 'models', 'countries.py');
const FRONTEND_PRICE_PATH = resolve(FRONTEND_ROOT, 'frontend', 'src', 'app', 'shared', 'models', 'price.ts');
const FRONTEND_COUNTRY_PATH = resolve(FRONTEND_ROOT, 'frontend', 'src', 'app', 'shared', 'models', 'country.ts');

function readOrThrow(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`Contract test: ${label} not found at ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

const backendSrc = readOrThrow(BACKEND_PRICE_PATH, 'backend/models/price.py');
const countriesSrc = readOrThrow(BACKEND_COUNTRIES_PATH, 'backend/models/countries.py');
const frontendSrc = readOrThrow(FRONTEND_PRICE_PATH, 'frontend price.ts');
const countrySrc = readOrThrow(FRONTEND_COUNTRY_PATH, 'frontend country.ts');

/** Extract Pydantic field names from a `class X(BaseModel):` block. */
function pyFields(src: string, className: string): string[] {
  const block = pyClassBlock(src, className);
  const fields: string[] = [];
  for (const line of block.split('\n')) {
    // Skip docstring lines (indented prose) — fields are `name: Type` at 4-space indent
    const f = line.match(/^\s{4}(\w+):\s+\w+/);
    if (f) fields.push(f[1]);
  }
  return fields;
}

/** Return the body of a `class X(` block, cut at the next top-level class. */
function pyClassBlock(src: string, className: string): string {
  const marker = `class ${className}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Contract: class ${className} not found in backend price.py`);
  const bodyStart = src.indexOf('\n', start) + 1;
  const nextClass = src.indexOf('\nclass ', bodyStart);
  const end = nextClass === -1 ? src.length : nextClass;
  return src.slice(bodyStart, end);
}

/** Extract interface field names from an `export interface X { ... }` block. */
function tsFields(src: string, name: string): string[] {
  const re = new RegExp(`export interface ${name} \\{[\\s\\S]*?\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`Contract: interface ${name} not found in frontend price.ts`);
  const fields: string[] = [];
  for (const line of m[0].split('\n')) {
    const f = line.match(/^\s{2}(\w+):/);
    if (f) fields.push(f[1]);
  }
  return fields;
}

/** Extract Python StrEnum members: `NAME = "value"`. */
function pyEnumValues(src: string, className: string): string[] {
  const block = pyClassBlock(src, className);
  const values: string[] = [];
  for (const line of block.split('\n')) {
    const v = line.match(/^\s{4}\w+\s*=\s*"([^"]+)"/);
    if (v) values.push(v[1]);
  }
  return values;
}

/** Extract TS string-literal union members: `'SE' | 'DK' | ...`. */
function tsUnionValues(src: string, typeName: string): string[] {
  const re = new RegExp(`export type ${typeName} = ([^;]+);`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`Contract: type ${typeName} not found`);
  const literals = m[1].match(/'([^']+)'/g) ?? [];
  return literals.map((l) => l.replace(/'/g, ''));
}

/** Extract the literal-union values of an interface field: `fuel: 'a' | 'b';`. */
function tsFieldUnionValues(src: string, field: string): string[] {
  const re = new RegExp(`\\n\\s*${field}: ([^;]+);`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`Contract: field ${field} not found in frontend price.ts`);
  const literals = m[1].match(/'([^']+)'/g) ?? [];
  return literals.map((l) => l.replace(/'/g, ''));
}

describe('Backend ↔ Frontend contract — price.ts vs price.py', () => {
  describe('PriceRecord', () => {
    const backendFields = pyFields(backendSrc, 'PriceRecord');
    const frontendFields = tsFields(frontendSrc, 'PriceRecord');

    it('should exist on both sides', () => {
      expect(backendFields.length).toBeGreaterThan(0);
      expect(frontendFields.length).toBeGreaterThan(0);
    });

    it('should have identical field sets (no drift)', () => {
      expect([...frontendFields].sort()).toEqual([...backendFields].sort());
    });
  });

  describe('PriceResponse', () => {
    const backendFields = pyFields(backendSrc, 'PriceResponse');
    const frontendFields = tsFields(frontendSrc, 'PriceResponse');

    it('should have identical field sets', () => {
      expect([...frontendFields].sort()).toEqual([...backendFields].sort());
    });
  });

  describe('Country values', () => {
    const backendValues = pyEnumValues(countriesSrc, 'Country');
    const frontendValues = tsUnionValues(countrySrc, 'Country');

    it('should have identical country codes', () => {
      expect([...frontendValues].sort()).toEqual([...backendValues].sort());
    });
  });

  describe('FuelType values', () => {
    const backendValues = pyEnumValues(backendSrc, 'FuelType');
    const frontendFuel = tsFieldUnionValues(frontendSrc, 'fuel');

    it('should have identical fuel identifiers', () => {
      expect([...frontendFuel].sort()).toEqual([...backendValues].sort());
    });
  });
});
