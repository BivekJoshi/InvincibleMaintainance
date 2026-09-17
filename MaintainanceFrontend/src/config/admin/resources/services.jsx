import { Badge } from '@/components/ui/badge';
import { DataIcon } from '@/components/site/DataIcon';
import { serviceSchema } from '@/form/schemas/cms.schema';
import { UNITS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';
import { ICON_OPTIONS } from './iconOptions';

/** Units read as written (`sq.ft`, `rft`) — the select would otherwise title-case them. */
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));

const TYPES = [
  { value: 'standard', label: 'Service (catalogue page)' },
  { value: 'other_civil', label: 'Other civil work (home page list)' },
];

/** "Rs 220 – Rs 275 / sq.ft", "From Rs 220", or "On inspection". */
function priceRange(r) {
  if (r.priceFrom == null) return 'On inspection';
  const unit = r.priceUnit ? ` / ${r.priceUnit}` : '';
  if (r.priceTo == null || r.priceTo === r.priceFrom) return `${formatNpr(r.priceFrom)}${unit}`;
  return `${formatNpr(r.priceFrom)} – ${formatNpr(r.priceTo)}${unit}`;
}

/** @type {import('../resourceRegistry').ResourceEntry} */
export const services = {
  resource: 'services',
  path: '/admin/services',
  model: 'service',
  label: 'Service',
  labelPlural: 'Services',
  description: 'The catalogue: what customers browse, compare by price and book.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: serviceSchema,
  sortable: true,
  translatable: ['name', 'excerpt', 'body'],
  titleOf: (record) => record.name,
  // "Other civil work" rows are a chip list on the home page and have no page of their own.
  publicHref: (record) => (record.type === 'other_civil' ? '/' : `/services/${record.slug}`),
  searchPlaceholder: 'Search services…',
  emptyTitle: 'No services yet',
  emptyDescription: 'Add the work you do, with a real description and a published price range.',

  columns: [
    {
      key: 'name', header: 'Service', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 max-w-md items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <DataIcon name={r.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 font-medium">
              <span className="truncate">{r.name}</span>
              {r.isFeatured ? <Badge variant="secondary" className="shrink-0 text-[10px]">Featured</Badge> : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{r.excerpt}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category', header: 'Category',
      cell: (r) => <span className="whitespace-nowrap text-sm">{r.category?.name ?? '—'}</span>,
    },
    {
      key: 'priceFrom', header: 'Price', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-sm tabular-nums">{priceRange(r)}</span>,
    },
  ],

  filters: [
    {
      key: 'categoryId', label: 'Category', type: 'relation',
      relation: { path: '/admin/service-categories', labelKey: 'name' },
    },
    { key: 'type', label: 'Type', type: 'enum', options: TYPES },
    // The API reads any `featured` value as "featured only", so there is no "not featured" choice.
    { key: 'featured', label: 'Featured', type: 'enum', options: [{ value: 'true', label: 'Featured only' }] },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 250 },
    {
      name: 'slug', type: 'slug', label: 'URL name', source: 'name', prefix: '/services/',
      description: 'The page address. Changing it breaks links people have saved.',
    },
    {
      name: 'categoryId', type: 'relation', label: 'Category', span: 'half',
      relation: { path: '/admin/service-categories', labelKey: 'name' },
    },
    { name: 'type', type: 'select', label: 'Type', span: 'half', required: true, options: TYPES },
    {
      name: 'excerpt', type: 'textarea', label: 'Card text', required: true, rows: 3, maxLength: 200,
      description: '40–200 characters, on the service card and in search results. Say what you actually do — not “Professional … with expert tools and results.”',
    },
    {
      name: 'body', type: 'prose', label: 'Page text', rows: 10,
      description: 'The service page. Separate paragraphs with a blank line.',
    },
    {
      type: 'group', label: 'Price', description: 'Published on the service page, the pricing page and in the estimator. Leave both empty for “priced on inspection”.',
      defaultOpen: true,
      fields: [
        { name: 'priceFrom', type: 'money', label: 'From', span: 'half' },
        { name: 'priceTo', type: 'money', label: 'To', span: 'half', description: 'At least the “from” price.' },
        { name: 'priceUnit', type: 'select', label: 'Per', span: 'half', options: UNIT_OPTIONS, noneLabel: 'Whole job' },
        { name: 'warrantyDays', type: 'number', label: 'Warranty (days)', span: 'half', min: 0, max: 3650, step: 1 },
      ],
    },
    { name: 'icon', type: 'select', label: 'Icon', span: 'half', options: ICON_OPTIONS, noneLabel: 'Default icon' },
    { name: 'imageId', type: 'media', label: 'Image', span: 'half' },
    { name: 'isFeatured', type: 'switch', label: 'Featured', span: 'half', description: 'Marks it in this list and the featured filter. No public page treats featured services differently yet.' },
    { name: 'isActive', type: 'switch', label: 'Show on the website', span: 'half' },
    {
      type: 'group', label: 'Search engines', description: 'Optional. The page title and card text are used when these are empty.',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Page title', maxLength: 180 },
        { name: 'metaDescription', type: 'textarea', label: 'Description', rows: 2, maxLength: 400 },
        { name: 'ogImageId', type: 'media', label: 'Sharing image' },
      ],
    },
  ],

  defaultValues: { type: 'standard', isActive: true, isFeatured: false },
};
