import { AMC_BILLING_CYCLES, AMC_BILLING_CYCLE_LABELS } from '@/config/constants';
import { titleCase } from '@/helpers/format';

/**
 * Aftercare's forms as `ResourceForm` fields (Phase I), where two screens share them. The create sheet and a
 * contract's Edit both use the plan fields; only the create sheet adds the customer and the schedule.
 */

const BILLING_OPTIONS = AMC_BILLING_CYCLES.map((c) => ({ value: c, label: AMC_BILLING_CYCLE_LABELS[c] }));

/**
 * A contract's plan: site, name, covered services, amount (rupees), billing cycle, notes. `sites` are the
 * customer's (`{ id, label, address, isPrimary }`); `services` the catalogue's names — covered services are
 * ticked from them, or typed one per line when the catalogue cannot be read. A value no longer in the
 * catalogue (the seed's `plumbing`) stays ticked until someone unticks it.
 *
 * @param {{ customerId?: string|null, sites?: object[], services?: string[] }} ctx
 */
export function amcPlanFields({ customerId, sites = [], services = [] }) {
  return [
    {
      name: 'siteId', type: 'select', label: 'Site', noneLabel: customerId ? 'No particular site' : 'Choose the customer first',
      options: sites.map((s) => ({ value: s.id, label: `${s.label}${s.isPrimary ? ' (primary)' : ''} · ${s.address}` })),
      disabled: !customerId,
    },
    { name: 'planName', type: 'text', label: 'Plan', required: true, maxLength: 160, placeholder: 'Annual Home Care — Standard' },
    services.length ? {
      name: 'coveredServices', type: 'checklist', label: 'Covered services',
      options: services.map((name) => ({ value: name, label: name })),
      unknownLabel: (value) => `${titleCase(value)} (not in the catalogue)`,
      description: 'From the service catalogue.',
    } : {
      name: 'coveredServices', type: 'stringList', label: 'Covered services', addLabel: 'Add a service', maxItems: 50,
      description: 'One per line, e.g. Plumbing.',
    },
    { name: 'amount', type: 'money', label: 'Amount', required: true, span: 'half', description: 'For the whole contract, in rupees.' },
    { name: 'billingCycle', type: 'select', label: 'Billed', required: true, span: 'half', options: BILLING_OPTIONS },
    { name: 'notes', type: 'textarea', label: 'Notes', rows: 3 },
  ];
}
