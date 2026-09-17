import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/badge';
import { StateBadge } from '@/components/common/StateBadge';
import { formatDate, formatNpr, titleCase } from '@/helpers/format';

/**
 * The record tabs on a customer's page: each is that domain's own list, filtered by the
 * customer. `can(role, can)` decides whether the tab shows — the same rule its API uses.
 * A record whose page is not built yet says "Soon" instead of linking nowhere.
 *
 * @typedef {{ key: string, label: string, kind: string, allowed: (ctx: { can: Function, role: string }) => boolean,
 *   columns: object[], href?: (row: object) => string, emptyTitle: string }} CustomerRecordTab
 */

const soon = <StateBadge title="This record’s page is not built yet">Soon</StateBadge>;
const number = (r) => <span className="font-mono text-xs">{r.number}</span>;
/** Warranties and AMC are mounted for these roles (aftercare.routes.js authorize). */
const AFTERCARE_ROLES = ['ADMIN', 'DISPATCHER', 'SALES', 'MANAGER'];

/** @type {CustomerRecordTab[]} */
export const CUSTOMER_RECORD_TABS = [
  {
    key: 'quotations', label: 'Quotations', kind: 'quotations',
    allowed: ({ can }) => can('quotations:read'),
    href: (r) => `/admin/quotations/${r.id}`,
    emptyTitle: 'No quotations yet',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: (r) => <Link to={`/admin/quotations/${r.id}`} className="font-mono text-xs hover:underline">{r.number}</Link> },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { key: 'total', header: 'Total', sortable: true, className: 'text-right tabular-nums', cell: (r) => formatNpr(r.total) },
      { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'jobs', label: 'Jobs', kind: 'jobs',
    allowed: ({ can }) => can('jobs:read'),
    emptyTitle: 'No jobs yet',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: number },
      { key: 'title', header: 'Job', cell: (r) => <span className="line-clamp-1">{r.title}</span> },
      { key: 'type', header: 'Type', cell: (r) => titleCase(r.type) },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { key: 'scheduledStart', header: 'When', sortable: true, cell: (r) => formatDate(r.scheduledStart) },
      { key: 'page', header: '', cell: () => soon },
    ],
  },
  {
    key: 'invoices', label: 'Invoices', kind: 'invoices',
    allowed: ({ can }) => can('invoices:read'),
    emptyTitle: 'No invoices yet',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: number },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { key: 'total', header: 'Total', sortable: true, className: 'text-right tabular-nums', cell: (r) => formatNpr(r.total) },
      { key: 'due', header: 'Still due', className: 'text-right tabular-nums', cell: (r) => formatNpr(Math.max(0, r.total - (r.paidAmount ?? 0))) },
      { key: 'dueDate', header: 'Due', sortable: true, cell: (r) => formatDate(r.dueDate) },
      { key: 'page', header: '', cell: () => soon },
    ],
  },
  {
    key: 'warranties', label: 'Warranties', kind: 'warranties',
    allowed: ({ role }) => AFTERCARE_ROLES.includes(role),
    emptyTitle: 'No warranties yet',
    columns: [
      { key: 'job', header: 'Job', cell: (r) => <span className="font-mono text-xs">{r.job?.number ?? '—'}</span> },
      { key: 'scope', header: 'Covers', cell: (r) => r.scope ?? r.job?.title ?? '—' },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { key: 'endsAt', header: 'Until', sortable: true, cell: (r) => formatDate(r.endsAt) },
      { key: 'page', header: '', cell: () => soon },
    ],
  },
  {
    key: 'contracts', label: 'AMC', kind: 'contracts',
    allowed: ({ role }) => AFTERCARE_ROLES.includes(role),
    emptyTitle: 'No maintenance contracts',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: number },
      { key: 'planName', header: 'Plan', cell: (r) => r.planName },
      { key: 'status', header: 'Status', cell: (r) => <StateBadge tone={r.status === 'active' ? 'success' : 'muted'}>{titleCase(r.status)}</StateBadge> },
      { key: 'period', header: 'Period', cell: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'amount', header: 'Amount', className: 'text-right tabular-nums', cell: (r) => formatNpr(r.amount) },
      { key: 'page', header: '', cell: () => soon },
    ],
  },
];
