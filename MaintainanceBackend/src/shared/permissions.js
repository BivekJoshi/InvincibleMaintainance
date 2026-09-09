/**
 * Role -> allowed capability map. The API is the authority; the admin SPA uses the
 * same map only to hide navigation.
 *
 * Capability format: "<domain>:<action>" with "*" as a wildcard.
 */
export const PERMISSIONS = {
  ADMIN: ['*'],
  EDITOR: [
    'cms:read', 'cms:write', 'media:read', 'media:write',
    'settings:read', 'testimonials:moderate', 'dashboard:read',
  ],
  SALES: [
    'leads:read', 'leads:write', 'customers:read', 'customers:write',
    'quotations:read', 'quotations:write', 'jobs:read', 'services:read',
    'surveys:read', 'surveys:write', 'technicians:read',
    'media:read', 'dashboard:read', 'reports:sales',
  ],
  DISPATCHER: [
    'jobs:read', 'jobs:write', 'jobs:dispatch', 'technicians:read', 'technicians:write',
    'materials:read', 'materials:write', 'customers:read', 'leads:read',
    'surveys:read',
    'media:read', 'media:write', 'dashboard:read', 'reports:ops',
  ],
  TECHNICIAN: ['jobs:own', 'media:write', 'dashboard:read'],
  // A surveyor reports quantities and never sees price. The absence of
  // quotations:read here IS the money wall — /admin/surveys/:id/pricing is
  // guarded by it, so a surveyor can open a survey but never its rates.
  SURVEYOR: ['jobs:own', 'surveys:own', 'media:write', 'dashboard:read'],
  ACCOUNTANT: [
    'invoices:read', 'invoices:write', 'payments:read', 'payments:write',
    'expenses:read', 'expenses:write', 'customers:read', 'jobs:read',
    'quotations:read', 'dashboard:read', 'reports:finance',
  ],
};

export function can(role, capability) {
  const list = PERMISSIONS[role] ?? [];
  if (list.includes('*')) return true;
  if (list.includes(capability)) return true;
  const [domain] = capability.split(':');
  return list.includes(`${domain}:*`);
}
