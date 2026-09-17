import { describe, it, expect } from 'vitest';
import { can, PERMISSIONS } from '../src/shared/permissions.js';
import { ROLES } from '../src/shared/enums.js';

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

  it('keeps permanent delete (cms:purge) with ADMIN alone', () => {
    expect(can('ADMIN', 'cms:purge')).toBe(true);
    for (const role of ['EDITOR', 'SALES', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT', 'TECHNICIAN', 'SURVEYOR']) {
      expect(can(role, 'cms:purge')).toBe(false);
    }
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

  it('gives record history to the people who work the record, not to every reader', () => {
    expect(can('SALES', 'leads:history')).toBe(true);
    expect(can('SALES', 'customers:history')).toBe(true);
    // DISPATCHER reads a lead to plan the visit and ACCOUNTANT reads a customer to bill it;
    // neither reads who changed what.
    expect(can('DISPATCHER', 'leads:read')).toBe(true);
    expect(can('DISPATCHER', 'leads:history')).toBe(false);
    expect(can('ACCOUNTANT', 'customers:history')).toBe(false);
    // Quotations: the people who prepare and approve them read the trail; accounts reads the figures only.
    expect(can('SALES', 'quotations:history')).toBe(true);
    expect(can('MANAGER', 'quotations:history')).toBe(true);
    expect(can('ACCOUNTANT', 'quotations:read')).toBe(true);
    expect(can('ACCOUNTANT', 'quotations:history')).toBe(false);
  });

  it('gives MANAGER every SALES capability plus quotation approval', () => {
    for (const c of PERMISSIONS.SALES) expect(can('MANAGER', c), c).toBe(true);
    expect(can('MANAGER', 'quotations:approve')).toBe(true);
    expect(can('MANAGER', 'reports:sales')).toBe(true);
    expect(can('MANAGER', 'invoices:write')).toBe(false);
    expect(can('MANAGER', 'jobs:write')).toBe(false);
    expect(can('MANAGER', 'users:write')).toBe(false);
  });

  it('keeps quotation approval with MANAGER and ADMIN only', () => {
    expect(can('ADMIN', 'quotations:approve')).toBe(true);
    for (const role of ['EDITOR', 'SALES', 'DISPATCHER', 'ACCOUNTANT', 'TECHNICIAN', 'SURVEYOR']) {
      expect(can(role, 'quotations:approve'), role).toBe(false);
    }
  });

  it('knows every role in the ROLES list', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });
});
