import { Badge } from '@/components/ui/badge';
import { faqSchema } from '@/form/schemas/cms.schema';
import { formatDate } from '@/helpers/format';

/**
 * A group decides where an FAQ shows: `general` on every service page, a service's
 * slug on that service's page only (see `getService` in the API's public service).
 * `pricing` and `warranty` are the seeded groups that no page lists yet.
 */
const GROUPS = [
  { value: 'general', label: 'General' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'warranty', label: 'Warranty' },
];
const SHOWN_NOWHERE = new Set(['pricing', 'warranty']);

/** @type {import('../resourceRegistry').ResourceEntry} */
export const faqs = {
  resource: 'faqs',
  path: '/admin/faqs',
  model: 'faq',
  label: 'FAQ',
  labelPlural: 'FAQs',
  description: 'Questions and answers shown on the service pages.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: faqSchema,
  sortable: true,
  translatable: ['question', 'answer'],
  titleOf: (record) => record.question,
  publicHref: (record) => {
    const group = record.group || 'general';
    if (SHOWN_NOWHERE.has(group)) return null;
    return group === 'general' ? '/services' : `/services/${group}`;
  },
  searchPlaceholder: 'Search questions and answers…',
  emptyTitle: 'No FAQs yet',
  emptyDescription: 'Answer the questions customers ask before they call.',

  columns: [
    {
      key: 'question', header: 'Question', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <p className="truncate font-medium">{r.question}</p>
          <p className="truncate text-xs text-muted-foreground">{r.answer}</p>
        </div>
      ),
    },
    {
      key: 'group', header: 'Group', sortable: true,
      cell: (r) => <Badge variant="outline" className="whitespace-nowrap font-mono text-[11px]">{r.group || '—'}</Badge>,
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  filters: [
    { key: 'group', label: 'Group', type: 'enum', allLabel: 'All groups', options: GROUPS },
  ],

  fields: [
    { name: 'question', type: 'text', label: 'Question', required: true, maxLength: 500 },
    {
      name: 'answer', type: 'textarea', label: 'Answer', required: true, rows: 5, maxLength: 5000,
      description: 'Plain text. The site shows it as one paragraph under the question.',
    },
    {
      name: 'group', type: 'text', label: 'Group', span: 'half', maxLength: 60, placeholder: 'general',
      description: '“general” shows on every service page; a service’s slug shows on that page only.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website', span: 'half' },
  ],

  defaultValues: { group: 'general', isActive: true },
};
