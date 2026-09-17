import { StateBadge } from '@/components/common/StateBadge';
import { postSchema } from '@/form/schemas/cms.schema';
import { publishState } from '@/helpers/schedule';

const TONE = { published: 'success', scheduled: 'info', draft: 'muted' };
const WORD = { published: 'Published', scheduled: 'Scheduled', draft: 'Draft' };

/**
 * A blog post. It is public once it is switched on **and** its publish time has passed:
 * no time is a draft, a future time schedules it.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const posts = {
  resource: 'posts',
  path: '/admin/posts',
  model: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  description: 'Articles on the blog. The site links to the blog once one is published.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: postSchema,
  // The blog lists newest first by publish time; the manual order shows nowhere.
  sortable: false,
  defaultSort: '-publishedAt',
  translatable: ['title', 'excerpt', 'body'],
  titleOf: (record) => record.title,
  publicHref: (record) => (record.isActive && publishState(record.publishedAt).status === 'published' ? `/blog/${record.slug}` : null),
  searchPlaceholder: 'Search posts…',
  emptyTitle: 'No posts yet',
  emptyDescription: 'Write up what your engineers see on site — it is what people search for.',

  columns: [
    {
      key: 'title', header: 'Post', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <p className="truncate font-medium">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">{r.category?.name ?? 'No category'}{r.excerpt ? ` · ${r.excerpt}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'publishedAt', header: 'Status', sortable: true,
      cell: (r) => {
        const { status, label } = publishState(r.publishedAt);
        return (
          <div className="space-y-0.5">
            <StateBadge tone={TONE[status]}>{WORD[status]}</StateBadge>
            {status === 'draft' ? null : <p className="whitespace-nowrap text-xs text-muted-foreground">{label}</p>}
          </div>
        );
      },
    },
  ],

  filters: [
    { key: 'categoryId', label: 'Category', type: 'relation', relation: { path: '/admin/post-categories', labelKey: 'name' } },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
    {
      name: 'slug', type: 'slug', label: 'URL name', source: 'title', prefix: '/blog/',
      description: 'The article’s address. Changing it after publishing breaks links people have shared.',
    },
    {
      name: 'categoryId', type: 'relation', label: 'Category', span: 'half',
      relation: { path: '/admin/post-categories', labelKey: 'name' },
    },
    {
      name: 'publishedAt', type: 'datetime', label: 'Publish at', span: 'half', defaultTime: '09:00',
      description: 'Empty: a draft. A time in the future schedules it (Nepal time).',
    },
    {
      name: 'excerpt', type: 'textarea', label: 'Standfirst', rows: 2, maxLength: 600,
      description: 'One or two sentences — on the blog card and above the article.',
    },
    {
      name: 'body', type: 'prose', label: 'Article', required: true, rows: 14,
      description: 'At least 20 characters. Separate paragraphs with a blank line.',
    },
    { name: 'coverId', type: 'media', label: 'Cover picture' },
    { name: 'isActive', type: 'switch', label: 'Show on the website', description: 'A switched-off post stays off the blog even after its publish time.' },
    {
      type: 'group', label: 'Search engines', description: 'Optional. The title and standfirst are used when these are empty.',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Page title', maxLength: 180 },
        { name: 'metaDescription', type: 'textarea', label: 'Description', rows: 2, maxLength: 400 },
      ],
    },
  ],

  defaultValues: { isActive: true },
};
