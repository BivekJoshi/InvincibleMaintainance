import { Badge } from '@/components/ui/badge';
import { pricingPlanSchema } from '@/form/schemas/cms.schema';
import { UNITS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

/** The site prints the unit after the price as typed ("/sq.ft"), so the choices are spelled that way. */
const UNIT_OPTIONS = UNITS.map((u) => ({ value: `/${u}`, label: `per ${u}` }));

const schema = pricingPlanSchema.superRefine((v, ctx) => {
  if (v.priceMin != null && v.priceMax != null && v.priceMax < v.priceMin) {
    ctx.addIssue({ code: 'custom', path: ['priceMax'], message: 'The “to” price must be at least the “from” price' });
  }
});

/** @type {import('../resourceRegistry').ResourceEntry} */
export const pricingPlans = {
  resource: 'pricing-plans',
  path: '/admin/pricing-plans',
  model: 'pricingPlan',
  label: 'Pricing plan',
  labelPlural: 'Pricing plans',
  description: 'Fixed-scope packages: the home page’s package grid, the pricing page and the estimator.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  sortable: true,
  translatable: ['title', 'badge', 'description'],
  titleOf: (record) => record.title,
  publicHref: () => '/pricing',
  searchPlaceholder: 'Search packages…',
  emptyTitle: 'No pricing plans yet',
  emptyDescription: 'A package with a published range and a list of what is included answers “how much?” before anyone calls.',

  columns: [
    {
      key: 'title', header: 'Package', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{r.title}</span>
            {r.badge ? <Badge variant="secondary" className="shrink-0 text-[10px]">{r.badge}</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{r.description}</p>
        </div>
      ),
    },
    {
      key: 'priceMin', header: 'Price', sortable: true,
      cell: (r) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {r.priceMin == null ? '—' : `${formatNpr(r.priceMin, { compact: true })} – ${formatNpr(r.priceMax ?? r.priceMin, { compact: true, symbol: false })}`}
          {r.unit ? <span className="text-muted-foreground"> {r.unit}</span> : null}
        </span>
      ),
    },
    {
      key: 'inclusions', header: 'Includes',
      cell: (r) => <span className="text-sm tabular-nums">{r.inclusions?.length ?? 0} items</span>,
    },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Name', required: true, maxLength: 250 },
    {
      name: 'badge', type: 'text', label: 'Badge', span: 'half', maxLength: 60, placeholder: 'Popular',
      description: '“Popular” lifts the card and rules it in gold on the home page.',
    },
    { name: 'unit', type: 'select', label: 'Per', span: 'half', options: UNIT_OPTIONS, noneLabel: 'Whole job' },
    { name: 'description', type: 'textarea', label: 'Description', rows: 2 },
    { name: 'priceMin', type: 'money', label: 'Price from', span: 'half' },
    { name: 'priceMax', type: 'money', label: 'Price to', span: 'half' },
    {
      name: 'inclusions', type: 'stringList', label: 'What is included', addLabel: 'Add a line', maxItems: 50,
      description: 'The home page card shows the first five.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true },
};
