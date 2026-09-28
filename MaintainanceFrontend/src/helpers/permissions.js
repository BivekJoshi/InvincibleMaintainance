/**
 * Mirrors the backend's src/shared/permissions.js. This only hides navigation —
 * the API is the authority and enforces the same map on every route.
 *
 * The money wall (Phase L2): `costs:read` — cost, margin, a recipe's cost, trade wages, job
 * costing — is MANAGER's (and ADMIN's through `*`). `rates:read` reads the rate library;
 * `rates:write` changes it and its trades, and reprices. SALES reads the library but never
 * writes it, because a recipe carries cost.
 *
 * Aftercare (Phase I) — `warranties:*`, `amc:*` and `reminders:*` replaced the API's role lists on
 * aftercare.routes.js with the same effective access: SALES, MANAGER and DISPATCHER read; DISPATCHER
 * (and ADMIN) writes.
 */
export const PERMISSIONS = {
  ADMIN: ['*'],
  EDITOR: ['cms:read', 'cms:write', 'media:read', 'media:write', 'settings:read', 'testimonials:moderate', 'dashboard:read'],
  SALES: [
    'leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history',
    'quotations:read', 'quotations:write', 'quotations:history', 'jobs:read', 'services:read',
    'surveys:read', 'surveys:write', 'technicians:read', 'rates:read',
    'warranties:read', 'amc:read', 'reminders:read',
    'media:read', 'dashboard:read', 'reports:sales',
  ],
  MANAGER: [
    'leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history',
    'quotations:read', 'quotations:write', 'quotations:history', 'quotations:approve', 'jobs:read', 'services:read',
    'surveys:read', 'surveys:write', 'technicians:read', 'rates:read', 'rates:write', 'costs:read',
    'jobs:advance-override',
    'warranties:read', 'amc:read', 'reminders:read',
    'media:read', 'dashboard:read', 'reports:sales',
  ],
  // Aftercare (Phase I): dispatch decides warranty claims (an accepted one is a job to schedule) and runs AMC
  // contracts and service reminders; SALES and MANAGER read them. ACCOUNTANT holds none of the three.
  DISPATCHER: [
    'jobs:read', 'jobs:write', 'jobs:dispatch', 'jobs:history', 'technicians:read', 'technicians:write',
    'materials:read', 'materials:write', 'customers:read', 'leads:read',
    'surveys:read', 'services:read',
    'warranties:read', 'warranties:write', 'amc:read', 'amc:write', 'reminders:read', 'reminders:write',
    'media:read', 'media:write', 'dashboard:read', 'reports:ops',
  ],
  TECHNICIAN: ['jobs:own', 'media:write', 'dashboard:read'],
  // No quotations:read — a surveyor reports quantities and never sees price.
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
