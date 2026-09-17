import { Badge } from '@/components/ui/badge';
import { materialSchema } from '@/form/schemas/ops.schema';
import { UNITS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';
import { inUseCopy } from './inUseCopy';

/** Units read as written (`sq.ft`, `kg`) — the select would otherwise title-case them. */
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));
const CATEGORY_RELATION = { path: '/admin/material-categories', labelKey: 'name' };
const SUPPLIER_RELATION = { path: '/admin/suppliers', labelKey: 'name' };

/**
 * The materials catalogue. Its stock is not a column: the balance is worked out from movements on
 * the Stock page, where purchases and wastage are recorded.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const materials = {
  resource: 'materials',
  path: '/admin/materials',
  basePath: '/admin/materials',
  model: 'material',
  label: 'Material',
  labelPlural: 'Materials',
  description: 'What jobs use, what it costs us and what we bill for it.',
  notice: 'Stock on hand is on the Stock page, worked out from every purchase, issue, return and adjustment. Rates here are per unit: the purchase rate costs a job, the sell rate bills it.',
  activeCopy: inUseCopy('Jobs that used it keep it, and so does its stock history.'),
  capability: 'materials:read',
  writeCapability: 'materials:write',
  schema: materialSchema,
  sortable: true,
  titleOf: (record) => `${record.code} · ${record.name}`,
  publicHref: () => null,
  searchPlaceholder: 'Search code or name…',
  emptyTitle: 'No materials yet',
  emptyDescription: 'Add what the teams take to site — then record a purchase on the Stock page.',

  columns: [
    { key: 'code', header: 'Code', sortable: true, cell: (r) => <span className="whitespace-nowrap font-mono text-xs font-semibold">{r.code}</span> },
    {
      key: 'name', header: 'Material', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{r.name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {r.category ? <Badge variant="outline" className="text-[10px]">{r.category.name}</Badge> : null}
            {r.supplier ? <span className="text-xs text-muted-foreground">{r.supplier.name}</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'purchaseRate', header: 'Costs us', sortable: true, className: 'text-right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatNpr(r.purchaseRate)} <span className="text-xs text-muted-foreground">/ {r.unit}</span></span>,
    },
    {
      key: 'sellRate', header: 'We bill', sortable: true, className: 'text-right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatNpr(r.sellRate)}</span>,
    },
    {
      key: 'reorderLevel', header: 'Reorder at', sortable: true, className: 'text-right',
      cell: (r) => <span className="tabular-nums">{r.reorderLevel ? `${r.reorderLevel} ${r.unit}` : '—'}</span>,
    },
  ],

  filters: [
    { key: 'categoryId', label: 'Category', type: 'relation', relation: CATEGORY_RELATION },
    { key: 'supplierId', label: 'Supplier', type: 'relation', relation: SUPPLIER_RELATION },
  ],

  fields: [
    { name: 'code', type: 'text', label: 'Code', required: true, span: 'half', maxLength: 40, placeholder: 'WP-CRYST', description: 'Unique. Letters, numbers, dash or underscore.' },
    { name: 'unit', type: 'select', label: 'Unit', required: true, span: 'half', options: UNIT_OPTIONS },
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 200 },
    { name: 'categoryId', type: 'relation', label: 'Category', span: 'half', relation: CATEGORY_RELATION },
    { name: 'supplierId', type: 'relation', label: 'Usual supplier', span: 'half', relation: SUPPLIER_RELATION },
    { name: 'purchaseRate', type: 'money', label: 'Purchase rate', span: 'half', description: 'Per unit. Costs a job.' },
    { name: 'sellRate', type: 'money', label: 'Sell rate', span: 'half', description: 'Per unit. What a job is billed unless someone changes it.' },
    {
      name: 'reorderLevel', type: 'number', label: 'Reorder at', span: 'half', min: 0, step: 0.5,
      description: 'Dispatch is told when stock falls to this. 0 = never.',
    },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired materials are not offered on new jobs.' },
  ],

  defaultValues: { isActive: true, unit: 'kg', purchaseRate: 0, sellRate: 0, reorderLevel: 0 },
};
