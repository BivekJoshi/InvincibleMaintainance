import { tradeSchema } from '@/form/schemas/rateCard.schema';
import { formatNpr } from '@/helpers/format';
import { inUseCopy } from './inUseCopy';

/**
 * Trades and their day wages (Phase L2) — mason, helper, painter… A recipe's labour is man-days of a
 * trade, costed at its day wage. Read with `rates:read`, changed with `rates:write`. The wage is cost:
 * the API sends it only to `costs:read`, and the column and field show only then.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const trades = {
  resource: 'trades',
  path: '/admin/trades',
  basePath: '/admin/trades',
  model: 'trade',
  label: 'Trade',
  labelPlural: 'Trades & wages',
  description: 'The trades a recipe’s labour is priced with.',
  notice: 'A day wage costs the labour in every recipe that uses the trade. Changing it never changes a rate: the rates it affects show “Out of date” in the rate library until someone updates them.',
  activeCopy: inUseCopy('Recipes that use it keep it.'),
  capability: 'rates:read',
  writeCapability: 'rates:write',
  schema: tradeSchema,
  sortable: true,
  titleOf: (record) => `${record.code} · ${record.name}`,
  publicHref: () => null,
  searchPlaceholder: 'Search code or name…',
  emptyTitle: 'No trades yet',
  emptyDescription: 'Add the trades your recipes use — mason, helper, painter.',

  columns: [
    { key: 'code', header: 'Code', sortable: true, cell: (r) => <span className="whitespace-nowrap font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', header: 'Trade', sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'dayWage', header: 'Day wage', sortable: true, className: 'text-right', capability: 'costs:read',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatNpr(r.dayWage)} <span className="text-xs text-muted-foreground">/ day</span></span>,
    },
  ],

  fields: [
    { name: 'code', type: 'text', label: 'Code', required: true, span: 'half', maxLength: 40, placeholder: 'MASON', description: 'Unique. Saved in capitals.' },
    { name: 'name', type: 'text', label: 'Trade', required: true, span: 'half', maxLength: 120, placeholder: 'Mason' },
    {
      name: 'dayWage', type: 'money', label: 'Day wage', span: 'half', capability: 'costs:read',
      description: 'What a day of this trade costs the company — a recipe’s labour is man-days × this.',
    },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired trades are not offered for new recipes.' },
  ],

  defaultValues: { isActive: true },
};
