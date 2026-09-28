import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from '@/components/common/StateBadge';
import { RateCostCard } from '@/components/rateLibrary/RateCostCard';
import { RateLibraryIntro } from '@/components/rateLibrary/RateLibraryIntro';
import { RepricePreview } from '@/components/rateLibrary/RepricePreview';
import { rateLibraryApi } from '@/api/rateLibraryApi';
import { rateCardItemSchema } from '@/form/schemas/rateCard.schema';
import { RATE_MODE_LABELS, UNITS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** Units read as written (`sq.ft`, `rft`) — the select would otherwise title-case them. */
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));
const MODE_OPTIONS = [
  { value: 'MANUAL', label: 'Typed by hand' },
  { value: 'DERIVED', label: 'Worked out from the recipe' },
];
/** The pickers offer what is in use; a line that names a retired one still shows it. */
const MATERIALS = { path: '/admin/materials', params: { onlyActive: 'true' } };
const TRADES = { path: '/admin/trades', params: { onlyActive: 'true' } };
const DEFAULT_NOTE = 'Blank uses the company default from Settings.';

/** Today's unit cost when the recipe is fully priced, else the cost when the rate was last set. */
const costOf = (r) => (r.costBreakdown?.complete ? r.costBreakdown.unitCost : r.unitCost);

/**
 * "Update to derived rate" on the selected rows: the reprice preview first (nothing written), the
 * changes in a confirmation, then the reprice for exactly the rates shown. Resolves the toast, or null
 * when the person says no.
 *
 * @param {object[]} rows
 * @param {{ dispatch: Function, confirm: (options: object) => Promise<boolean> }} helpers
 */
async function updateToDerivedRate(rows, { dispatch, confirm }) {
  const reprice = (arg) => dispatch(rateLibraryApi.endpoints.repriceRateCard.initiate(arg)).unwrap();
  const preview = await reprice({ ids: rows.map((r) => r.id), apply: false });
  const items = preview?.items ?? [];
  if (!items.length) {
    return {
      title: 'Nothing to update',
      description: 'Each selected rate is typed by hand, already at its derived rate, or missing a price in its recipe.',
      variant: 'default',
    };
  }
  const n = items.length;
  const ok = await confirm({
    title: n === 1 ? `Update ${items[0].code} to its derived rate?` : `Update ${n} rates to their derived rates?`,
    description: <RepricePreview items={items} unchanged={rows.length - n} />,
    confirmLabel: n === 1 ? 'Update the rate' : `Update ${n} rates`,
  });
  if (!ok) return null;
  const done = await reprice({ ids: items.map((i) => i.id), apply: true });
  const applied = done?.applied ?? n;
  return {
    title: applied === 1 ? '1 rate updated to its derived rate' : `${applied} rates updated to their derived rates`,
    description: 'New quotations and the pricing page use the new rates. Quotations already sent keep theirs.',
  };
}

/**
 * The rate library (Phase L2; the "rate card" before it): the selling rate per unit of work, and the recipe
 * behind it. It is sales data, not content — it lives in the Catalog at its own address, read with
 * `rates:read` (SALES, MANAGER, ACCOUNTANT) and written with `rates:write` (MANAGER). Cost — the Cost and
 * Margin columns, the recipe's costs, overhead, profit and rounding, the Cost vs rate card — shows only
 * with `costs:read`; the API strips it for everyone else, and the client never works it out.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const rateCard = {
  resource: 'rate-card',
  path: '/admin/rate-card',
  basePath: '/admin/rate-card',
  model: 'rateCardItem',
  label: 'Rate',
  labelPlural: 'Rate library',
  description: 'Selling rates per unit of work, and the recipes behind them.',
  notice: 'These rates fill quotation lines, price site surveys and make up the rate table on the public pricing page. A new material price or day wage never changes a rate by itself: the rates it affects show “Out of date” until someone updates them. The estimator uses each service’s own price range, set on the service.',
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
  capability: 'rates:read',
  writeCapability: 'rates:write',
  schema: rateCardItemSchema,
  sortable: true,
  titleOf: (record) => `${record.code} · ${record.name}`,
  publicHref: (record) => (record.isActive ? '/pricing' : null),
  intro: (record) => <RateLibraryIntro record={record} />,
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
    {
      key: 'rateMode', header: 'Set by',
      cell: (r) => <StateBadge tone={r.rateMode === 'DERIVED' ? 'info' : 'muted'}>{RATE_MODE_LABELS[r.rateMode] ?? 'Manual'}</StateBadge>,
      exportValue: (r) => RATE_MODE_LABELS[r.rateMode] ?? 'Manual',
    },
    {
      key: 'outOfDate', header: 'Price check',
      cell: (r) => {
        if (r.outOfDate) {
          return (
            <div className="whitespace-nowrap">
              <StateBadge tone="warning">Out of date</StateBadge>
              <p className="mt-0.5 text-xs text-muted-foreground">Recipe gives <span className="tabular-nums">{formatNpr(r.derivedRate)}</span></p>
            </div>
          );
        }
        return r.rateMode === 'DERIVED' ? <span className="text-xs text-muted-foreground">Up to date</span> : <span className="text-muted-foreground">—</span>;
      },
      exportValue: (r) => (r.outOfDate ? `Out of date (recipe gives ${formatNpr(r.derivedRate)})` : ''),
    },
    {
      key: 'unitCost', header: 'Cost', capability: 'costs:read', className: 'text-right',
      cell: (r) => (costOf(r) == null
        ? <span className="text-muted-foreground">—</span>
        : <span className="whitespace-nowrap tabular-nums">{formatNpr(costOf(r))}</span>),
    },
    {
      key: 'margin', header: 'Margin', capability: 'costs:read', className: 'text-right',
      cell: (r) => (r.margin?.pct == null
        ? <span className="text-muted-foreground">—</span>
        : <span className={cn('tabular-nums', r.margin.amount < 0 && 'text-destructive')}>{r.margin.pct}%</span>),
      exportValue: (r) => (r.margin?.pct == null ? '' : `${r.margin.pct}%`),
    },
  ],

  bulkActions: [
    { label: 'Update to derived rate', icon: RefreshCw, capability: 'rates:write', run: updateToDerivedRate },
  ],

  fields: [
    {
      name: 'code', type: 'text', label: 'Code', required: true, span: 'half', maxLength: 40, placeholder: 'WP-TERRACE',
      description: 'Unique. Saved in capitals.',
    },
    { name: 'category', type: 'text', label: 'Category', span: 'half', maxLength: 80, placeholder: 'Waterproofing' },
    { name: 'name', type: 'text', label: 'Work', required: true, maxLength: 200 },
    { name: 'description', type: 'textarea', label: 'Description', rows: 3 },
    { name: 'unit', type: 'select', label: 'Per', required: true, span: 'half', options: UNIT_OPTIONS },
    {
      name: 'rateMode', type: 'select', label: 'Rate set by', required: true, span: 'half', options: MODE_OPTIONS,
      description: 'From the recipe: cost plus overhead and profit, rounded up. A price change marks it out of date; it never moves by itself.',
    },
    {
      name: 'rate', type: 'money', label: 'Rate', span: 'half',
      adapt: (v) => (v.rateMode === 'DERIVED'
        ? { disabled: true, description: 'Set from the recipe when you save.' }
        : { required: true, description: 'The selling rate per unit.' }),
    },
    {
      name: 'recipeQty', type: 'number', label: 'Recipe is for', span: 'half', min: 0.001, step: 'any',
      adapt: (v) => ({ description: `How many ${v.unit || 'units'} of work the quantities below make — DoR norms are often per 10 or 100.` }),
    },
    {
      name: 'components', type: 'recipe', label: 'Recipe', materials: MATERIALS, trades: TRADES,
      costCapability: 'costs:read', per: { qty: 'recipeQty', unit: 'unit' },
      adapt: (v) => (v.rateMode === 'DERIVED'
        ? { required: true, description: 'Sets the rate. Material quantities are in each material’s own unit; labour in man-days.' }
        : { description: 'Optional on a typed rate: it only works out what the work costs, for its margin. Material quantities are in each material’s own unit; labour in man-days.' }),
    },
    {
      name: 'overheadPct', type: 'number', label: 'Overhead %', span: 'half', min: 0, max: 200, step: 'any',
      capability: 'costs:read', nullable: true, description: `On the direct cost. ${DEFAULT_NOTE}`,
    },
    {
      name: 'profitPct', type: 'number', label: 'Profit %', span: 'half', min: 0, max: 500, step: 'any',
      capability: 'costs:read', nullable: true, description: `On the unit cost. ${DEFAULT_NOTE}`,
    },
    {
      name: 'roundTo', type: 'money', label: 'Round up to', span: 'half',
      capability: 'costs:read', nullable: true, description: `The derived rate rounds up to a multiple of this. ${DEFAULT_NOTE}`,
    },
    { name: 'costPreview', type: 'preview', label: 'Cost vs rate', component: RateCostCard, capability: 'costs:read' },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired rates stay on old quotations but are not offered again.' },
  ],

  defaultValues: { isActive: true, unit: 'sq.ft', rateMode: 'MANUAL', recipeQty: 1, components: [] },
};
