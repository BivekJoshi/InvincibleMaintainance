import { Badge } from '@/components/ui/badge';
import { rateCardItemSchema } from '@/form/schemas/rateCard.schema';
import { UNITS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

/** Units read as written (`sq.ft`, `rft`) — the select would otherwise title-case them. */
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));

/**
 * The rate card is sales data, not content: it lives under Sales at its own address and is
 * guarded by the quotation capabilities (ACCOUNTANT reads it, SALES / MANAGER / ADMIN write it).
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const rateCard = {
  resource: 'rate-card',
  path: '/admin/rate-card',
  basePath: '/admin/rate-card',
  model: 'rateCardItem',
  label: 'Rate',
  labelPlural: 'Rate card',
  description: 'Unit rates for the work we price.',
  notice: 'These rates fill quotation lines, price site surveys and make up the rate table on the public pricing page. The estimator uses each service’s own price range, set on the service.',
  activeCopy: {
    column: 'In use',
    switchLabel: 'Offer this rate:',
    turnOn: 'Put back in use',
    turnOff: 'Retire',
    turnedOn: 'is back in use',
    turnedOff: 'is retired — no longer offered on new quotations or the pricing page',
    deleteOne: 'It leaves the pricing page and new quotations at once; lines already quoted keep their price.',
    deleteMany: 'They leave the pricing page and new quotations at once; lines already quoted keep their price.',
  },
  capability: 'quotations:read',
  // An accountant reads the rates, not who changed them.
  historyCapability: 'quotations:history',
  writeCapability: 'quotations:write',
  schema: rateCardItemSchema,
  sortable: true,
  titleOf: (record) => `${record.code} · ${record.name}`,
  publicHref: (record) => (record.isActive ? '/pricing' : null),
  searchPlaceholder: 'Search code, name or category…',
  emptyTitle: 'No rates yet',
  emptyDescription: 'Add the unit rates quotations are built from.',

  columns: [
    {
      key: 'code', header: 'Code', sortable: true,
      cell: (r) => <span className="whitespace-nowrap font-mono text-xs font-semibold">{r.code}</span>,
    },
    {
      key: 'name', header: 'Work', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{r.name}</p>
          {r.category ? <Badge variant="outline" className="mt-0.5 text-[10px]">{r.category}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'rate', header: 'Rate', sortable: true, className: 'text-right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatNpr(r.rate)} <span className="text-xs text-muted-foreground">/ {r.unit}</span></span>,
    },
  ],

  fields: [
    {
      name: 'code', type: 'text', label: 'Code', required: true, span: 'half', maxLength: 40, placeholder: 'WP-TERRACE',
      description: 'Unique. Saved in capitals.',
    },
    { name: 'category', type: 'text', label: 'Category', span: 'half', maxLength: 80, placeholder: 'Waterproofing' },
    { name: 'name', type: 'text', label: 'Work', required: true, maxLength: 200 },
    { name: 'description', type: 'textarea', label: 'Description', rows: 3 },
    { name: 'rate', type: 'money', label: 'Rate', required: true, span: 'half' },
    { name: 'unit', type: 'select', label: 'Per', required: true, span: 'half', options: UNIT_OPTIONS },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired rates stay on old quotations but are not offered again.' },
  ],

  defaultValues: { isActive: true, unit: 'sq.ft' },
};
