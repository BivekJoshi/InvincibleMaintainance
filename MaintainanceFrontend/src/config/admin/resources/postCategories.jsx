import { postCategorySchema } from '@/form/schemas/cms.schema';
import { formatDate } from '@/helpers/format';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const postCategories = {
  resource: 'post-categories',
  path: '/admin/post-categories',
  model: 'postCategory',
  label: 'Post category',
  labelPlural: 'Post categories',
  description: 'Topics for the blog. A category shows as a filter once it holds a published post.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: postCategorySchema,
  sortable: true,
  titleOf: (record) => record.name,
  publicHref: (record) => `/blog?category=${encodeURIComponent(record.slug)}`,
  searchPlaceholder: 'Search categories…',
  emptyTitle: 'No post categories yet',
  emptyDescription: 'A few broad topics are enough — damp, renovation, home care.',

  columns: [
    { key: 'name', header: 'Category', sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'slug', header: 'Address', cell: (r) => <span className="font-mono text-xs text-muted-foreground">/blog?category={r.slug}</span> },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 250 },
    { name: 'slug', type: 'slug', label: 'URL name', source: 'name', prefix: '/blog?category=' },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true },
};
