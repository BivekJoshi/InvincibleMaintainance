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

  it('keeps SURVEYOR away from money', () => {
    // The absence of quotations:read is the money wall — /admin/surveys/:id/pricing
    // is guarded by it, so a surveyor can fill in a survey but never see its rates.
    expect(can('SURVEYOR', 'surveys:own')).toBe(true);
    expect(can('SURVEYOR', 'jobs:own')).toBe(true);
    expect(can('SURVEYOR', 'quotations:read')).toBe(false);
    expect(can('SURVEYOR', 'materials:read')).toBe(false);
    expect(can('SURVEYOR', 'invoices:read')).toBe(false);
    expect(can('SURVEYOR', 'surveys:write')).toBe(false);
  });

  it('lets sales review surveys but keeps dispatch read-only on them', () => {
    expect(can('SALES', 'surveys:write')).toBe(true);
    expect(can('DISPATCHER', 'surveys:read')).toBe(true);
    // tech.routes.js#writeSurvey leans on this: DISPATCHER may be waved past the
    // ownership check (they hold jobs:write) but must not reach a survey write.
    expect(can('DISPATCHER', 'surveys:write')).toBe(false);
    expect(can('DISPATCHER', 'jobs:write')).toBe(true);
    expect(can('DISPATCHER', 'quotations:read')).toBe(false);
  });

  it('keeps ACCOUNTANT out of dispatch', () => {
    expect(can('ACCOUNTANT', 'invoices:write')).toBe(true);
    expect(can('ACCOUNTANT', 'jobs:write')).toBe(false);
  });
});
