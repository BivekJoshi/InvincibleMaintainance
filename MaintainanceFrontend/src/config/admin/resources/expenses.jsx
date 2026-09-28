import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { AdBsDate } from '@/components/common/AdBsDate';
import { expenseSchema } from '@/form/schemas/finance.schema';
import { formatNpr, imageUrl } from '@/helpers/format';

/** Jobs, as an expense's relation and filter pick them (`jobs:read`, which ACCOUNTANT holds). */
const JOB_RELATION = { path: '/admin/jobs', labelKey: (r) => `${r.number} · ${r.title}` };

/** The categories already in use, as the category field's suggestions; refreshed after any expense is saved. */
const CATEGORY_SUGGESTIONS = { path: '/admin/expenses/categories', tag: { type: 'Cms', id: 'expenses' } };

/** A bill's thumbnail from the row's `bill` (url, thumb), so the list needs no media lookup. */
function billThumb(bill) {
  if (!bill) return <span className="text-xs text-muted-foreground">No bill</span>;
  const src = bill.thumb ?? imageUrl(bill, 400) ?? bill.url;
  return (
    <a
      href={bill.url ?? src}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-10 w-14 shrink-0 overflow-hidden rounded-md border bg-muted"
      aria-label="Open the bill"
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Receipt className="m-auto h-4 w-4 text-muted-foreground" aria-hidden />}
    </a>
  );
}

/**
 * Money spent on the company's behalf (Phase I): a category, the amount, when, who was paid, the bill, and the job it
 * was for — which is what puts it on that job's costing and in the margin report. **Who recorded it is the
 * server's**: `approvedBy` is set to the user who saves it, and the answer names them as `approver`.
 *
 * No on/off switch and no manual order — the model has neither (`toggle: false`, `sortable: false`); a delete is
 * soft, with Trash and Restore. The list's footer is the server's total of the filtered expenses (`meta.totals`).
 * The bill photo is the kit's `photoUpload` field: taken or chosen, uploaded to `POST /admin/expenses/bill`
 * (`expenses:write` — ACCOUNTANT holds no `media:*`, so never MediaPicker), its id saved as `billMediaId`; the row's
 * `bill` (`{ url, thumb }`) shows it in the list, above the form and in the field.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const expenses = {
  resource: 'expenses',
  path: '/admin/expenses',
  basePath: '/admin/expenses',
  model: 'expense',
  label: 'Expense',
  labelPlural: 'Expenses',
  description: 'What the company spent: fuel, transport, a tool bought on site — against a job where there is one.',
  notice: 'An expense recorded against a job is part of that job’s cost: its Costing tab and the job-margin report both include it.',
  capability: 'expenses:read',
  writeCapability: 'expenses:write',
  toggle: false,
  sortable: false,
  defaultSort: '-spentAt',
  activeCopy: {
    deleteOne: 'It leaves the totals and the job’s costing.',
    deleteMany: 'They leave the totals and the jobs’ costing.',
  },
  schema: expenseSchema,
  titleOf: (record) => `${record.category} · ${formatNpr(record.amount)}`,
  publicHref: () => null,
  searchPlaceholder: 'Search category, vendor or note…',
  emptyTitle: 'No expenses recorded',
  emptyDescription: 'Record one with New Expense — attach the bill, and the job it was for.',

  columns: [
    { key: 'spentAt', header: 'Spent', sortable: true, cell: (r) => <AdBsDate iso={r.spentAt} />, exportValue: (r) => r.spentAt?.slice(0, 10) ?? '' },
    {
      key: 'category', header: 'What', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate font-medium">{r.category}</p>
          {r.vendor ? <p className="truncate text-xs text-muted-foreground">{r.vendor}</p> : null}
        </div>
      ),
      exportValue: (r) => [r.category, r.vendor].filter(Boolean).join(' — '),
    },
    {
      key: 'job', header: 'Job',
      cell: (r) => (r.job ? (
        <Link to={`/admin/jobs/${r.job.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs hover:text-primary hover:underline">{r.job.number}</Link>
      ) : <span className="text-xs text-muted-foreground">Overhead</span>),
      exportValue: (r) => r.job?.number ?? '',
    },
    {
      key: 'amount', header: 'Amount', sortable: true, className: 'text-right',
      cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums">{formatNpr(r.amount)}</span>,
    },
    { key: 'bill', header: 'Bill', cell: (r) => billThumb(r.bill), exportValue: (r) => (r.bill ? 'Yes' : '') },
    { key: 'approver', header: 'Recorded by', cell: (r) => <span className="text-xs">{r.approver?.name ?? '—'}</span>, exportValue: (r) => r.approver?.name ?? '' },
  ],

  filters: [
    { key: 'category', label: 'Category', type: 'text', placeholder: 'Category' },
    { key: 'jobId', label: 'Job', type: 'relation', relation: JOB_RELATION },
    { key: 'spent', label: 'Spent', type: 'dateRange' },
  ],

  /** The server's total of the filtered expenses (`meta.totals.total`), under the table. */
  footer: (meta, { inTrash } = {}) => (meta?.totals && !inTrash ? (
    <p className="mt-3 flex justify-end gap-2 text-sm" data-testid="expenses-total">
      <span className="text-muted-foreground">Total of {meta.total === 1 ? 'this expense' : `these ${meta.total ?? ''} expenses`}</span>
      <span className="font-semibold tabular-nums">{formatNpr(meta.totals.total)}</span>
    </p>
  ) : null),

  intro: (r) => (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-muted-foreground">Recorded by</dt><dd>{r.approver?.name ?? '—'}</dd></div>
      <div>
        <dt className="text-xs text-muted-foreground">Job</dt>
        <dd>{r.job ? <Link to={`/admin/jobs/${r.job.id}`} className="font-mono text-xs hover:underline">{r.job.number}</Link> : 'Overhead'}</dd>
      </div>
      <div><dt className="text-xs text-muted-foreground">Bill</dt><dd>{billThumb(r.bill)}</dd></div>
    </dl>
  ),

  fields: [
    {
      name: 'category', type: 'text', label: 'Category', required: true, span: 'half', maxLength: 80,
      placeholder: 'Transport', suggestionsFrom: CATEGORY_SUGGESTIONS,
      description: 'Pick one already in use where it fits, so the totals group together.',
    },
    { name: 'amount', type: 'money', label: 'Amount', required: true, span: 'half' },
    { name: 'spentAt', type: 'date', label: 'Spent on', span: 'half', description: 'Today, when left empty.' },
    { name: 'vendor', type: 'text', label: 'Paid to', span: 'half', maxLength: 160, nullable: true, placeholder: 'Shop or person' },
    {
      name: 'jobId', type: 'relation', label: 'For job', relation: JOB_RELATION, nullable: true,
      description: 'Leave empty for an overhead. A job’s expenses are part of its cost.',
    },
    {
      // Uploaded straight to POST /admin/expenses/bill (expenses:write) — no media library, which ACCOUNTANT cannot browse.
      name: 'billMediaId', type: 'photoUpload', label: 'Bill photo', nullable: true,
      upload: '/admin/expenses/bill', savedFrom: 'bill', addLabel: 'Choose or take a photo',
      description: 'A photo of the receipt — taken on the phone, or chosen from the computer.',
    },
    { name: 'note', type: 'textarea', label: 'Note', rows: 3, maxLength: 2000 },
  ],

  defaultValues: {},
};
