import { Link } from 'react-router-dom';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { StateBadge } from '@/components/common/StateBadge';
import { AdBsDate } from '@/components/common/AdBsDate';
import { usePurchaseListActions } from '@/hooks/usePurchaseListActions';
import { purchaseListSchema } from '@/form/schemas/ops.schema';
import { PURCHASE_LIST_STATUSES, PURCHASE_LIST_STATUS_LABELS } from '@/config/constants';
import {
  PURCHASE_LIST_TONES, itemCountText, purchaseListDeletable, purchaseListLock,
} from '@/helpers/purchaseLists';
import { formatQty } from '@/helpers/handoff';
import { formatDate } from '@/helpers/format';

const JOB_RELATION = { path: '/admin/jobs', labelKey: (r) => `${r.number} · ${r.title}` };
const SUPPLIER_RELATION = { path: '/admin/suppliers', labelKey: 'name' };
const MATERIALS = { path: '/admin/materials' };

const codeName = (m) => (m ? `${m.code} · ${m.name}` : '');
const materialOption = (m) => `${codeName(m)} (${m.unit})`;
/** What a row keeps of the material it names, for its label, unit and pack — never a rate. */
const materialOf = (m) => (m ? { id: m.id, code: m.code, name: m.name, unit: m.unit, packSize: m.packSize ?? null, packLabel: m.packLabel ?? null } : null);
const numberCell = (v) => (typeof v === 'number' ? formatQty(v) : v ?? '');
const rowName = (row, i) => (row?.material?.name ?? `Item ${i + 1}`);

/**
 * The items grid (a `grid` field — EditableGrid behind ResourceForm). A row is the API's item as it is (`materialId`,
 * `material`, `qty`, `packs`, `note`, and `receivedQty` once received); the schema sends `{ materialId, qty, packs?,
 * note? }`. The material is picked from the catalogue in a record picker that opens on Enter; the unit and the pack
 * follow it. Quantities in the material's own unit — no rate here: the stock movement costs it at the purchase rate.
 */
const ITEM_COLUMNS = [
  {
    key: 'material', header: 'Material', grow: 1, minWidth: 220, editor: 'custom',
    get: (row) => row.materialId ?? null,
    set: (row, value) => ({ ...row, ...value }),
    toText: (_v, row) => (row.material ? codeName(row.material) : ''),
    label: (row, i) => `Material, item ${i + 1}`,
    placeholder: 'Choose a material',
    format: (_v, row) => (
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate">{row.material ? codeName(row.material) : ''}</span>
        {row.material?.packSize && row.material?.packLabel
          ? <span className="truncate text-xs text-muted-foreground">Bought as {row.material.packLabel} = {Number(row.material.packSize)} {row.material.unit}</span>
          : null}
      </span>
    ),
    renderEditor: ({ row, commit, cancel, label, draft }) => (
      <RecordCombobox
        {...MATERIALS}
        labelKey={materialOption}
        value={row.materialId ?? null}
        selectedLabel={row.material ? materialOption(row.material) : undefined}
        onChange={(value, record) => commit({ materialId: value ?? null, material: value ? materialOf(record) ?? row.material : null })}
        onOpenChange={(open) => { if (!open) cancel(); }}
        defaultOpen
        returnFocus={false}
        defaultSearch={draft ?? ''}
        placeholder="Choose a material…"
        searchPlaceholder="Search code or name…"
        clearable={false}
        aria-label={label}
        className="h-full w-full"
      />
    ),
  },
  {
    key: 'qty', header: 'Quantity', width: 100, editor: 'number', align: 'right', format: numberCell,
    label: (row, i) => `Quantity of ${rowName(row, i)}`,
  },
  { key: 'unit', header: 'Unit', width: 72, get: (row) => row.material?.unit ?? '' },
  {
    key: 'packs', header: 'Packs', width: 88, editor: 'number', align: 'right',
    format: (v, row) => (v === '' || v == null ? '' : `${numberCell(v)} ${row.material?.packLabel ?? ''}`.trim()),
    label: (row, i) => `Packs of ${rowName(row, i)}`,
  },
  { key: 'note', header: 'Note', width: 160, editor: 'text', maxLength: 300, label: (row, i) => `Note on ${rowName(row, i)}` },
  {
    key: 'receivedQty', header: 'Received', width: 92, align: 'right',
    format: (v) => (v == null || v === '' ? <span className="text-muted-foreground">—</span> : numberCell(v)),
  },
];

const blankItem = () => ({ materialId: null, material: null, qty: '', packs: '', note: '' });

const statusBadge = (status) => (
  <StateBadge tone={PURCHASE_LIST_TONES[status] ?? 'muted'} className={status === 'CANCELLED' ? 'line-through' : undefined}>
    {PURCHASE_LIST_STATUS_LABELS[status] ?? status}
  </StateBadge>
);

const jobLink = (job) => (job ? (
  <Link to={`/admin/jobs/${job.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs hover:text-primary hover:underline">{job.number}</Link>
) : <span className="text-xs text-muted-foreground">For the store</span>);

/**
 * Purchase lists (Phase L7): what to buy — usually for a job, drafted from its shortfall on the job's Materials /
 * Labour tab — ordered from a supplier and received into stock. A registry entry (`materials:read` / `materials:write`),
 * with the list's moves beside the eight endpoints: **Mark ordered**, **Receive into stock…** (a PURCHASE stock
 * movement per item, with the supplier and the list's number) and **Cancel list…** — `useRecordActions`, offered in a
 * row's menu and on the list's page. Only a draft is edited (`readOnlyReason`) or deleted (`deletable`). No on/off
 * switch, no manual order; newest first.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const purchaseLists = {
  resource: 'purchase-lists',
  path: '/admin/purchase-lists',
  basePath: '/admin/purchase-lists',
  model: 'purchaseList',
  label: 'Purchase list',
  labelPlural: 'Purchase lists',
  description: 'What to buy — for a job’s shortfall or for the store — ordered from a supplier, then received into stock.',
  notice: 'Receiving a list adds each item to stock as a purchase from its supplier. A list is edited only while it is a draft; a job’s Materials / Labour tab drafts one from what the job is short of.',
  capability: 'materials:read',
  writeCapability: 'materials:write',
  toggle: false,
  sortable: false,
  defaultSort: '-createdAt',
  activeCopy: {
    deleteOne: 'Only a draft is deleted — an ordered list is cancelled instead.',
    deleteMany: 'Only drafts are deleted — an ordered list is cancelled instead.',
  },
  schema: purchaseListSchema,
  titleOf: (record) => record.number ?? 'Purchase list',
  publicHref: () => null,
  searchPlaceholder: 'Search number, job, supplier or note…',
  emptyTitle: 'No purchase lists yet',
  emptyDescription: 'Draft one from a job’s shortfall, or with New Purchase list for the store.',

  readOnlyReason: purchaseListLock,
  deletable: purchaseListDeletable,
  useRecordActions: usePurchaseListActions,

  columns: [
    {
      key: 'number', header: 'List', sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold">{r.number}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => statusBadge(r.status), exportValue: (r) => PURCHASE_LIST_STATUS_LABELS[r.status] ?? r.status },
    { key: 'job', header: 'Job', cell: (r) => jobLink(r.job), exportValue: (r) => r.job?.number ?? '' },
    { key: 'supplier', header: 'Supplier', cell: (r) => r.supplier?.name ?? <span className="text-muted-foreground">—</span>, exportValue: (r) => r.supplier?.name ?? '' },
    {
      key: 'items', header: 'Items',
      cell: (r) => (
        <div className="min-w-0 max-w-xs text-xs">
          <p className="font-medium">{itemCountText(r.itemCount ?? r.items?.length ?? 0)}</p>
          <p className="truncate text-muted-foreground">{(r.items ?? []).map((i) => i.material?.name).filter(Boolean).join(', ')}</p>
        </div>
      ),
      exportValue: (r) => (r.items ?? []).map((i) => `${i.material?.name ?? ''} ${formatQty(i.qty)} ${i.material?.unit ?? ''}`.trim()).join('; '),
    },
    { key: 'orderedAt', header: 'Ordered', sortable: true, cell: (r) => (r.orderedAt ? <AdBsDate iso={r.orderedAt} /> : <span className="text-muted-foreground">—</span>), exportValue: (r) => r.orderedAt?.slice(0, 10) ?? '' },
    { key: 'receivedAt', header: 'Received', sortable: true, cell: (r) => (r.receivedAt ? <AdBsDate iso={r.receivedAt} /> : <span className="text-muted-foreground">—</span>), exportValue: (r) => r.receivedAt?.slice(0, 10) ?? '' },
  ],

  filters: [
    {
      key: 'status', label: 'Status', type: 'enum',
      options: PURCHASE_LIST_STATUSES.map((value) => ({ value, label: PURCHASE_LIST_STATUS_LABELS[value] })),
    },
    { key: 'jobId', label: 'Job', type: 'relation', relation: JOB_RELATION },
    { key: 'supplierId', label: 'Supplier', type: 'relation', relation: SUPPLIER_RELATION },
  ],

  intro: (r) => (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4" data-testid="purchase-list-intro">
      <div><dt className="text-xs text-muted-foreground">Status</dt><dd>{statusBadge(r.status)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Job</dt><dd>{jobLink(r.job)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Ordered</dt><dd>{r.orderedAt ? <AdBsDate iso={r.orderedAt} /> : '—'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Received</dt><dd>{r.receivedAt ? <AdBsDate iso={r.receivedAt} /> : '—'}</dd></div>
      {r.cancelReason ? (
        <div className="sm:col-span-4"><dt className="text-xs text-muted-foreground">Why it was cancelled</dt><dd lang="ne">“{r.cancelReason}”</dd></div>
      ) : null}
    </dl>
  ),

  fields: [
    {
      name: 'jobId', type: 'relation', label: 'For job', relation: JOB_RELATION, nullable: true, span: 'half',
      description: 'Leave empty for stock bought for the store.',
    },
    { name: 'supplierId', type: 'relation', label: 'Supplier', relation: SUPPLIER_RELATION, nullable: true, span: 'half' },
    {
      name: 'items', type: 'grid', label: 'Items', columns: ITEM_COLUMNS, makeRow: blankItem, maxItems: 200, addLabel: 'Add item',
      emptyText: 'No items yet — press Enter on a Material cell to choose one.',
      description: 'Quantity in the material’s own unit; packs when it is bought by the pack.',
    },
    { name: 'note', type: 'textarea', label: 'Note', rows: 2, maxLength: 2000 },
  ],

  defaultValues: { jobId: null, supplierId: null, items: [] },
};
