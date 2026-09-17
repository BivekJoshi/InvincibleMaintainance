import { PERMISSIONS, can } from '@/helpers/permissions';

/** What each capability domain is about, in the office's words. */
export const CAPABILITY_DOMAINS = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  customers: 'Customers',
  quotations: 'Quotations and rate card',
  surveys: 'Site surveys',
  services: 'Service catalogue',
  jobs: 'Jobs',
  technicians: 'Technicians',
  materials: 'Materials and stock',
  invoices: 'Invoices',
  payments: 'Payments',
  expenses: 'Expenses',
  reports: 'Reports',
  cms: 'Website content',
  media: 'Media library',
  testimonials: 'Testimonials',
  settings: 'Site settings',
  users: 'Users and sign-in',
  audit: 'Audit log',
  messages: 'Message templates and delivery',
};

/** What each action means. */
export const CAPABILITY_ACTIONS = {
  read: 'see',
  write: 'change',
  history: 'see who changed what',
  approve: 'approve',
  dispatch: 'schedule and assign',
  own: 'work their own assignments',
  moderate: 'approve for the site',
  purge: 'delete for good',
  sales: 'sales reports',
  ops: 'operations reports',
  finance: 'finance reports',
  admin: 'manage',
};

/**
 * Capabilities only ADMIN holds (through `*`), so the map never names them — listed so the
 * matrix shows what the wildcard means.
 */
const ADMIN_ONLY = ['settings:write', 'cms:purge', 'users:admin', 'audit:read', 'messages:admin'];

/**
 * Every capability any role names (plus the ADMIN-only ones), grouped by domain in the
 * order above, with the roles that hold each.
 *
 * @param {string[]} roles
 * @returns {{ domain: string, label: string, rows: { capability: string, action: string, holders: Record<string, boolean> }[] }[]}
 */
export function capabilityMatrix(roles) {
  const all = new Set([...Object.values(PERMISSIONS).flat().filter((c) => c !== '*'), ...ADMIN_ONLY]);
  const order = Object.keys(CAPABILITY_DOMAINS);
  const byDomain = new Map();
  for (const capability of all) {
    const [domain, action] = capability.split(':');
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push({
      capability,
      action: CAPABILITY_ACTIONS[action] ?? action,
      holders: Object.fromEntries(roles.map((role) => [role, can(role, capability)])),
    });
  }
  const rank = (d) => (order.includes(d) ? order.indexOf(d) : order.length);
  return [...byDomain.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([domain, rows]) => ({
      domain,
      label: CAPABILITY_DOMAINS[domain] ?? domain,
      rows: rows.sort((a, b) => a.capability.localeCompare(b.capability)),
    }));
}
