import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import { UNITS } from '@/config/constants';
import { serviceSchema } from '@/form/schemas/cms.schema';
import { rateCardItemSchema } from '@/form/schemas/rateCard.schema';
// The API's own cases, run against this mirror: the form must refuse exactly what the API refuses.
// The fixture lives in the API's tests, outside `src/`, so `@/` cannot reach it.
import { SERVICE_BASE, SERVICE_SCHEMA_CASES } from '../../../../MaintainanceBackend/tests/fixtures/serviceSchemaCases.js';


describe('service schema mirrors the API', () => {
  it('runs the API’s cases', () => {
    expect(SERVICE_SCHEMA_CASES.length).toBeGreaterThan(10);
  });

  it.each(SERVICE_SCHEMA_CASES.map((c) => [c.name, c]))('%s', (_name, c) => {
    const r = serviceSchema.safeParse({ ...SERVICE_BASE, ...c.input });
    expect(r.success).toBe(c.valid);
    if (!c.valid && c.path) expect(r.error.issues.map((i) => i.path.join('.'))).toContain(c.path);
  });
});

describe('rate card schema', () => {
  it('upper-cases the code, as the API stores it', () => {
    const r = rateCardItemSchema.safeParse({ code: 'wp-terrace', name: 'Terrace waterproofing', unit: 'sq.ft', rate: '275.50' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ code: 'WP-TERRACE', rate: 275.5 });
  });

  it('refuses a code with spaces and a unit the API does not know', () => {
    expect(rateCardItemSchema.safeParse({ code: 'WP TERRACE', name: 'x x', unit: 'sq.ft', rate: 1 }).success).toBe(false);
    expect(rateCardItemSchema.safeParse({ code: 'WP', name: 'x x', unit: 'acre', rate: 1 }).success).toBe(false);
  });
});

describe('units', () => {
  it('are the API’s list, in its order', () => {
    const enums = readFileSync(resolve(cwd(), '../MaintainanceBackend/src/shared/enums.js'), 'utf8');
    const api = enums.match(/export const UNITS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map((u) => u.slice(1, -1));
    expect(UNITS).toEqual(api);
  });
});
