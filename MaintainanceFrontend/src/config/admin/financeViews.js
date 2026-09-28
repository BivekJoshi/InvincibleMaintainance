import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/config/constants';

/**
 * The finance screens' vocabulary (Phase I): the invoice list's status tabs, the aging buckets, the revenue
 * groupings and the report tabs — data, so the pages and their tests read one list.
 */

/**
 * The invoice list's tabs. `count` is the key of the list's `meta.counts` (the server counts each status under the
 * other filters); `status` is what the tab sends (`all` sends none).
 */
export const INVOICE_TABS = [
  { value: 'all', label: 'All', count: 'all' },
  ...['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE', 'PAID', 'VOID'].map((s) => ({
    value: s, label: INVOICE_STATUS_LABELS[s], count: s, status: s,
  })),
];

/** The aging report's buckets, oldest last. The keys are the API's (`buckets.d0_30` …). */
export const AGING_BUCKETS = [
  { key: 'current', label: 'Not yet due', short: 'Current' },
  { key: 'd0_30', label: '1–30 days overdue', short: '1–30' },
  { key: 'd31_60', label: '31–60 days overdue', short: '31–60' },
  { key: 'd61_90', label: '61–90 days overdue', short: '61–90' },
  { key: 'd90_plus', label: 'Over 90 days overdue', short: '90+' },
];

/** How the revenue report groups (the API's `REVENUE_GROUPS`; `day` is left to the CSV). */
export const REVENUE_GROUPINGS = [
  { value: 'month', label: 'By month' },
  { value: 'service', label: 'By service' },
  { value: 'technician', label: 'By technician' },
];

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

/** `/admin/finance/reports?report=` */
export const FINANCE_REPORTS = [
  { value: 'aging', label: 'Aging' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'collections', label: 'Collections' },
  { value: 'statement', label: 'Customer statement' },
];

/**
 * `/admin/reports/:group` — the sales and operations reports, each group behind one capability (its nav item's), and
 * each report inside it a tab (`?report=`). Job margin is behind the money wall (`costs:read`), on its own.
 */
export const REPORT_GROUPS = [
  {
    value: 'sales', label: 'Sales reports', capability: 'reports:sales',
    reports: [
      { value: 'lead-sources', label: 'Lead sources' },
      { value: 'funnel', label: 'Funnel' },
      { value: 'sla', label: 'SLA compliance' },
      { value: 'lost', label: 'Lost leads' },
    ],
  },
  {
    value: 'operations', label: 'Operations reports', capability: 'reports:ops',
    reports: [
      { value: 'technicians', label: 'Technicians' },
      { value: 'warranty-claims', label: 'Warranty claims' },
    ],
  },
  {
    value: 'job-margin', label: 'Job margin', capability: 'costs:read',
    reports: [{ value: 'job-margin', label: 'Job margin' }],
  },
];

/** The report groups a user may open, by `can(capability)`. */
export const reportGroupsFor = (can) => REPORT_GROUPS.filter((g) => can(g.capability));
