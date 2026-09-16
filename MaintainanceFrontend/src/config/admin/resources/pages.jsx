import { pageSchema } from '@/form/schemas/cms.schema';
import { RESERVED_SLUGS } from '@/config/site/siteNav';
import { formatDate } from '@/helpers/format';
import { slugify } from '@/helpers/slug';

/**
 * A page at `/<slug>`. The site's own routes win over a page of the same name, so an
 * address the site already uses is refused.
 */
const schema = pageSchema.superRefine((v, ctx) => {
  const slug = v.slug || slugify(v.title ?? '');
  if (RESERVED_SLUGS.includes(slug)) {
    ctx.addIssue({
      code: 'custom',
      path: [v.slug ? 'slug' : 'title'],
      message: `/${slug} is already a page of the site — choose another address`,
    });
  }
});

/** @type {import('../resourceRegistry').ResourceEntry} */
export const pages = {
  resource: 'pages',
  path: '/admin/pages',
  model: 'page',
  label: 'Page',
  labelPlural: 'Pages',
  description: 'Standalone pages such as About or warranty terms, each at its own address.',
  notice: 'A switched-on page can be linked from a hero slide, an offer or a content block by its address, e.g. /about.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  sortable: false,
  translatable: ['title', 'body'],
  titleOf: (record) => record.title,
  publicHref: (record) => `/${record.slug}`,
  searchPlaceholder: 'Search pages…',
  emptyTitle: 'No pages yet',
  emptyDescription: 'Tell visitors who you are — an About page is a good first one.',

  columns: [
    { key: 'title', header: 'Page', sortable: true, cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'slug', header: 'Address', sortable: true, cell: (r) => <span className="font-mono text-xs">/{r.slug}</span> },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
    {
      name: 'slug', type: 'slug', label: 'Address', source: 'title', prefix: '/',
      description: 'Changing it breaks links to this page.',
    },
    { name: 'body', type: 'prose', label: 'Text', rows: 14, description: 'Separate paragraphs with a blank line.' },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
    {
      type: 'group', label: 'Search engines', description: 'Optional. The title is used when these are empty.',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Page title', maxLength: 180 },
        { name: 'metaDescription', type: 'textarea', label: 'Description', rows: 2, maxLength: 400 },
      ],
    },
  ],

  defaultValues: { isActive: true },
};
