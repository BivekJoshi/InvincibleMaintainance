/**
 * Mirrors the backend's src/shared/permissions.js. This only hides navigation —
 * the API is the authority and enforces the same map on every route.
 */
export const PERMISSIONS = {
  ADMIN: ['*'],
  EDITOR: ['cms:read', 'cms:write', 'media:read', 'media:write', 'settings:read', 'testimonials:moderate', 'dashboard:read'],
  SALES: ['leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history', 'quotations:read', 'quotations:write', 'quotations:history', 'jobs:read', 'services:read', 'surveys:read', 'surveys:write', 'technicians:read', 'media:read', 'dashboard:read', 'reports:sales'],
  MANAGER: ['leads:read', 'leads:write', 'leads:history', 'customers:read', 'customers:write', 'customers:history', 'quotations:read', 'quotations:write', 'quotations:history', 'quotations:approve', 'jobs:read', 'services:read', 'surveys:read', 'surveys:write', 'technicians:read', 'media:read', 'dashboard:read', 'reports:sales'],
  DISPATCHER: ['jobs:read', 'jobs:write', 'jobs:dispatch', 'technicians:read', 'technicians:write', 'materials:read', 'materials:write', 'customers:read', 'leads:read', 'surveys:read', 'media:read', 'media:write', 'dashboard:read', 'reports:ops'],
  TECHNICIAN: ['jobs:own', 'media:write', 'dashboard:read'],
  // No quotations:read — a surveyor reports quantities and never sees price.
  SURVEYOR: ['jobs:own', 'surveys:own', 'media:write', 'dashboard:read'],
  ACCOUNTANT: ['invoices:read', 'invoices:write', 'payments:read', 'payments:write', 'expenses:read', 'expenses:write', 'customers:read', 'jobs:read', 'quotations:read', 'dashboard:read', 'reports:finance'],
};

export function can(role, capability) {
  const list = PERMISSIONS[role] ?? [];
  if (list.includes('*')) return true;
  if (list.includes(capability)) return true;
  const [domain] = capability.split(':');
  return list.includes(`${domain}:*`);
}
