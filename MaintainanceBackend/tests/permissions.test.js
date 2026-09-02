import { describe, it, expect } from 'vitest';
import { can } from '../src/shared/permissions.js';

describe('role capabilities', () => {
  it('gives ADMIN everything', () => {
    for (const c of ['leads:write', 'invoices:write', 'cms:write', 'anything:at-all']) {
      expect(can('ADMIN', c)).toBe(true);
    }
  });

  it('keeps SALES out of finance and user management', () => {
    expect(can('SALES', 'leads:write')).toBe(true);
    expect(can('SALES', 'quotations:write')).toBe(true);
    expect(can('SALES', 'invoices:write')).toBe(false);
    expect(can('SALES', 'jobs:dispatch')).toBe(false);
  });

  it('keeps EDITOR inside content', () => {
    expect(can('EDITOR', 'cms:write')).toBe(true);
    expect(can('EDITOR', 'leads:read')).toBe(false);
  });

  it('gives TECHNICIAN only their own jobs', () => {
    expect(can('TECHNICIAN', 'jobs:own')).toBe(true);
    expect(can('TECHNICIAN', 'jobs:read')).toBe(false);
    expect(can('TECHNICIAN', 'customers:read')).toBe(false);
  });

  it('keeps ACCOUNTANT out of dispatch', () => {
    expect(can('ACCOUNTANT', 'invoices:write')).toBe(true);
    expect(can('ACCOUNTANT', 'jobs:write')).toBe(false);
  });
});
