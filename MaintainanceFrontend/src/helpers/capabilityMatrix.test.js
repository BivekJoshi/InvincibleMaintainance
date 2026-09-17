import { describe, it, expect } from 'vitest';
import { capabilityMatrix } from '@/helpers/capabilityMatrix';
import { PERMISSIONS } from '@/helpers/permissions';
import { ROLES } from '@/config/constants';

describe('capabilityMatrix', () => {
  const matrix = capabilityMatrix(ROLES);
  const rows = matrix.flatMap((g) => g.rows);
  const row = (capability) => rows.find((r) => r.capability === capability);

  it('lists every capability a role holds, once', () => {
    const named = new Set(Object.values(PERMISSIONS).flat().filter((c) => c !== '*'));
    for (const capability of named) expect(row(capability), capability).toBeTruthy();
    expect(new Set(rows.map((r) => r.capability)).size).toBe(rows.length);
  });

  it('marks who holds each, ADMIN everything', () => {
    expect(row('quotations:approve').holders).toMatchObject({ ADMIN: true, MANAGER: true, SALES: false });
    expect(row('jobs:history').holders).toMatchObject({ DISPATCHER: true, SALES: false });
    expect(row('users:admin').holders).toEqual(Object.fromEntries(ROLES.map((r) => [r, r === 'ADMIN'])));
    expect(rows.every((r) => r.holders.ADMIN)).toBe(true);
  });

  it('keeps the money wall visible: a surveyor never reads quotations', () => {
    expect(row('quotations:read').holders.SURVEYOR).toBe(false);
  });

  it('groups by domain in business order, with words', () => {
    expect(matrix[0]).toMatchObject({ domain: 'dashboard', label: 'Dashboard' });
    expect(matrix.map((g) => g.domain).indexOf('leads')).toBeLessThan(matrix.map((g) => g.domain).indexOf('users'));
    expect(row('leads:history').action).toBe('see who changed what');
  });
});
