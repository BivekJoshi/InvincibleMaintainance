import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/badge';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { formatBalance, formatDate, formatNpr, formatSignedNpr, titleCase } from '@/helpers/format';
import { INVOICE_STATUS_LABELS, JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';

/**
 * The record tabs on a customer's page: each is that domain's own list, filtered by the
 * customer. `can(role, can)` decides whether the tab shows — the same rule its API uses.
 * Every record here has its own page (invoices, warranties and AMC since Phase I).
 *
 * @typedef {{ key: string, label: string, kind: string, allowed: (ctx: { can: Function, role: string }) => boolean,
 *   columns: object[], href?: (row: object) => string, emptyTitle: string }} CustomerRecordTab
 */

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
      // A variation's total may be below zero (Phase L7): "− Rs. …".
      { key: 'total', header: 'Total', sortable: true, className: 'text-right tabular-nums', cell: (r) => formatSignedNpr(r.total) },
      { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'jobs', label: 'Jobs', kind: 'jobs',
    allowed: ({ can }) => can('jobs:read'),
    href: (r) => `/admin/jobs/${r.id}`,
    emptyTitle: 'No jobs yet',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: (r) => <Link to={`/admin/jobs/${r.id}`} className="font-mono text-xs hover:underline">{r.number}</Link> },
      { key: 'title', header: 'Job', cell: (r) => <span className="line-clamp-1">{r.title}</span> },
      { key: 'type', header: 'Type', cell: (r) => JOB_TYPE_LABELS[r.type] ?? titleCase(r.type) },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} label={JOB_STATUS_LABELS[r.status]} /> },
      { key: 'scheduledStart', header: 'When', sortable: true, cell: (r) => formatDate(r.scheduledStart) },
    ],
  },
  {
    // Phase I: the invoice's own page; "still due" is the server's `balance`, never worked out here.
    key: 'invoices', label: 'Invoices', kind: 'invoices',
    allowed: ({ can }) => can('invoices:read'),
    href: (r) => `/admin/invoices/${r.id}`,
    emptyTitle: 'No invoices yet',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: (r) => <Link to={`/admin/invoices/${r.id}`} className="font-mono text-xs hover:underline">{r.number}</Link> },
      { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} label={INVOICE_STATUS_LABELS[r.status]} /> },
      { key: 'total', header: 'Total', sortable: true, className: 'text-right tabular-nums', cell: (r) => formatNpr(r.total) },
      { key: 'due', header: 'Still due', className: 'text-right tabular-nums', cell: (r) => (r.status === 'VOID' ? '—' : formatBalance(r.balance)) },
      { key: 'dueDate', header: 'Due', sortable: true, cell: (r) => formatDate(r.dueDate) },
    ],
  },
  {
    // Phase I: the warranty's own page; `warranties:read` (SALES, MANAGER, DISPATCHER, ADMIN).
    key: 'warranties', label: 'Warranties', kind: 'warranties',
    allowed: ({ can }) => can('warranties:read'),
    href: (r) => `/admin/warranties/${r.id}`,
    emptyTitle: 'No warranties yet',
    columns: [
      { key: 'job', header: 'Job', cell: (r) => <Link to={`/admin/warranties/${r.id}`} className="font-mono text-xs hover:underline">{r.job?.number ?? '—'}</Link> },
      { key: 'scope', header: 'Covers', cell: (r) => <span className="line-clamp-1">{r.scope || r.job?.title || '—'}</span> },
      { key: 'status', header: 'Status', cell: (r) => <AftercareStatus kind="warranty" status={r.status} /> },
      { key: 'endsAt', header: 'Until', sortable: true, cell: (r) => formatDate(r.endsAt) },
      { key: 'claims', header: 'Claims', className: 'text-right tabular-nums', cell: (r) => r.claims?.length ?? 0 },
    ],
  },
  {
    // Phase I: the contract's own page; `amc:read`. The amount is the server's paisa.
    key: 'contracts', label: 'AMC', kind: 'contracts',
    allowed: ({ can }) => can('amc:read'),
    href: (r) => `/admin/amc-contracts/${r.id}`,
    emptyTitle: 'No maintenance contracts',
    columns: [
      { key: 'number', header: 'Number', sortable: true, cell: (r) => <Link to={`/admin/amc-contracts/${r.id}`} className="font-mono text-xs hover:underline">{r.number}</Link> },
      { key: 'planName', header: 'Plan', cell: (r) => r.planName },
      { key: 'status', header: 'Status', cell: (r) => <AftercareStatus kind="amc" status={r.status} /> },
      { key: 'period', header: 'Period', cell: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
      { key: 'amount', header: 'Amount', className: 'text-right tabular-nums', cell: (r) => formatNpr(r.amount) },
    ],
  },
];
