import { CheckCircle2, Undo2 } from 'lucide-react';
import { StateBadge } from '@/components/common/StateBadge';
import { Stars } from '@/components/site/Stars';
import { testimonialSchema } from '@/form/schemas/cms.schema';
import { cn } from '@/helpers/utils';

const APPROVAL = [
  { value: 'false', label: 'Waiting for approval' },
  { value: 'true', label: 'Approved' },
  // Anything but true/false lists both (the API's filter).
  { value: 'all', label: 'All testimonials' },
];

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'ne', label: 'नेपाली (Nepali)' },
];

/**
 * A testimonial is published as written, in its own language — there is no Nepali tab.
 * It reaches the site only once someone with `testimonials:moderate` approves it, which
 * is a row action here rather than a form field.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const testimonials = {
  resource: 'testimonials',
  path: '/admin/testimonials',
  model: 'testimonial',
  label: 'Testimonial',
  labelPlural: 'Testimonials',
  description: 'What customers say, shown on the home page once approved.',
  notice: 'A new testimonial waits here until it is approved. Only approved testimonials that are switched on appear on the site.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: testimonialSchema,
  sortable: true,
  titleOf: (record) => `${record.author}: “${record.quote.slice(0, 60)}${record.quote.length > 60 ? '…' : ''}”`,
  publicHref: (record) => (record.isApproved ? '/' : null),
  searchPlaceholder: 'Search quotes, names, places…',
  emptyTitle: 'Nothing here',
  emptyDescription: 'No testimonial matches. New ones wait under “Waiting for approval”.',

  columns: [
    {
      key: 'quote', header: 'Testimonial',
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <p className={cn('truncate', r.locale === 'ne' && 'font-deva')} lang={r.locale}>“{r.quote}”</p>
          <p className={cn('truncate text-xs text-muted-foreground', r.locale === 'ne' && 'font-deva')} lang={r.locale}>
            {[r.author, r.location].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    { key: 'rating', header: 'Rating', sortable: true, cell: (r) => <Stars rating={r.rating} /> },
    {
      key: 'locale', header: 'Language',
      cell: (r) => <span className="text-sm">{r.locale === 'ne' ? 'Nepali' : 'English'}</span>,
    },
    {
      key: 'isApproved', header: 'Approval', sortable: true,
      cell: (r) => (r.isApproved
        ? <StateBadge tone="success">Approved</StateBadge>
        : <StateBadge tone="warning">Waiting</StateBadge>),
    },
  ],

  filters: [
    { key: 'approved', label: 'Approval', type: 'enum', options: APPROVAL, defaultValue: 'false', className: 'w-[200px]' },
  ],

  rowActions: (row) => [
    row.isApproved
      ? {
        label: 'Withdraw approval', icon: Undo2, capability: 'testimonials:moderate',
        endpoint: 'approveTestimonial', arg: { id: row.id, isApproved: false }, done: 'Approval withdrawn — it is off the site',
      }
      : {
        label: 'Approve', icon: CheckCircle2, capability: 'testimonials:moderate',
        endpoint: 'approveTestimonial', arg: { id: row.id, isApproved: true }, done: 'Testimonial approved',
      },
  ],

  fields: [
    {
      name: 'quote', type: 'textarea', label: 'Quote', required: true, rows: 5, maxLength: 2000,
      description: 'As the customer wrote it, in their language. 10–2,000 characters.',
    },
    { name: 'author', type: 'text', label: 'Name', required: true, span: 'half', maxLength: 120 },
    { name: 'location', type: 'text', label: 'Place', span: 'half', maxLength: 160, placeholder: 'Jhamsikhel, Lalitpur' },
    {
      name: 'rating', type: 'select', label: 'Rating', span: 'half', required: true,
      options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} star${n === 1 ? '' : 's'}` })),
    },
    {
      name: 'locale', type: 'select', label: 'Written in', span: 'half', required: true, options: LOCALES,
      description: 'Sets the typeface on the site.',
    },
    { name: 'photoId', type: 'media', label: 'Photo', description: 'Optional — only with the customer’s permission.' },
    { name: 'isActive', type: 'switch', label: 'Show on the website once approved' },
  ],

  defaultValues: { rating: 5, locale: 'en', isActive: true, isApproved: false },
};
