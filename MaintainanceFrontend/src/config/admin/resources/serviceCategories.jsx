import { serviceCategorySchema } from '@/form/schemas/cms.schema';
import { DataIcon } from '@/components/site/DataIcon';
import { formatDate } from '@/helpers/format';
import { ICON_OPTIONS } from './iconOptions';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const serviceCategories = {
  resource: 'service-categories',
  path: '/admin/service-categories',
  model: 'serviceCategory',
  label: 'Service category',
  labelPlural: 'Service categories',
  description: 'The category rail in the site header, the home page tiles and the catalogue filter, in this order.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: serviceCategorySchema,
  sortable: true,
  translatable: ['name'],
  titleOf: (record) => record.name,
  publicHref: (record) => (record.slug ? `/services?category=${encodeURIComponent(record.slug)}` : '/services'),
  searchPlaceholder: 'Search categories…',
  emptyTitle: 'No service categories yet',
  emptyDescription: 'Group the services the way customers look for them.',

  columns: [
    {
      key: 'name', header: 'Category', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <DataIcon name={r.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">/{r.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 250 },
    {
      name: 'slug', type: 'slug', label: 'URL name', source: 'name', prefix: '/services?category=',
      description: 'Used in catalogue links. Changing it breaks links people have saved.',
    },
    {
      name: 'icon', type: 'select', label: 'Icon', span: 'half', options: ICON_OPTIONS, noneLabel: 'Default icon',
      description: 'Shown on the category tile and in the header rail.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website', span: 'half' },
    { name: 'imageId', type: 'media', label: 'Image' },
  ],

  defaultValues: { isActive: true },
};
