/**
 * Role -> allowed capability map. The API is the authority; the admin SPA uses the
 * same map only to hide navigation.
 *
 * Capability format: "<domain>:<action>" with "*" as a wildcard.
 */
export const PERMISSIONS = {
  // '*' is also the only holder of cms:purge — permanent delete of CMS rows and
  // media (`?hard=true`). Every other role's delete is a soft delete it can restore.
  ADMIN: ['*'],
  EDITOR: [
    'cms:read', 'cms:write', 'media:read', 'media:write',
    'settings:read', 'testimonials:moderate', 'dashboard:read',
  ],
  // *:history reads a record's own audit trail (who changed what). The people who work
  // a record hold it; a reader does not — a dispatcher reads a lead to plan a visit, not
  // its trail. EDITOR reads a CMS record's trail with cms:read.
  // rates:read — the rate library, to price with (Phase L2). Writing it needs rates:write,
  // because a recipe carries cost; SALES quotes with selling rates and never sees cost.
  SALES: [
    'leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history',
    'quotations:read', 'quotations:write', 'quotations:history', 'jobs:read', 'services:read',
    'surveys:read', 'surveys:write', 'technicians:read', 'rates:read',
    'media:read', 'dashboard:read', 'reports:sales',
  ],
  // Sales plus the internal approval of quotations (Phase F). quotations:approve is
  // held here and by ADMIN ('*') only. The money wall (L-D4, Phase L2): costs:read — cost,
  // margin, recipe cost, trade wages, job costing — is held here and by ADMIN only; so are
  // the rate library's writes and the advance override (enforced from L6).
  MANAGER: [
    'leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history',
    'quotations:read', 'quotations:write', 'quotations:history', 'quotations:approve', 'jobs:read', 'services:read',
    'surveys:read', 'surveys:write', 'technicians:read', 'rates:read', 'rates:write', 'costs:read',
    'jobs:advance-override',
    'media:read', 'dashboard:read', 'reports:sales',
  ],
  DISPATCHER: [
    'jobs:read', 'jobs:write', 'jobs:dispatch', 'jobs:history', 'technicians:read', 'technicians:write',
    'materials:read', 'materials:write', 'customers:read', 'leads:read',
    // services:read: a job template belongs to a service (Phase H1).
    'surveys:read', 'services:read',
    'media:read', 'media:write', 'dashboard:read', 'reports:ops',
  ],
  TECHNICIAN: ['jobs:own', 'media:write', 'dashboard:read'],
  // A surveyor reports quantities and never sees price. The absence of
  // quotations:read here IS the money wall — /admin/surveys/:id/pricing is
  // guarded by it, so a surveyor can open a survey but never its rates.
  SURVEYOR: ['jobs:own', 'surveys:own', 'media:write', 'dashboard:read'],
  ACCOUNTANT: [
    'invoices:read', 'invoices:write', 'invoices:history', 'payments:read', 'payments:write',
    'expenses:read', 'expenses:write', 'customers:read', 'jobs:read',
    'quotations:read', 'rates:read', 'dashboard:read', 'reports:finance',
  ],
};

export function can(role, capability) {
  const list = PERMISSIONS[role] ?? [];
  if (list.includes('*')) return true;
  if (list.includes(capability)) return true;
  const [domain] = capability.split(':');
  return list.includes(`${domain}:*`);
}
