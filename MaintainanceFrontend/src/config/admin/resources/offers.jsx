import { Badge } from '@/components/ui/badge';
import { StateBadge } from '@/components/common/StateBadge';
import { offerSchema } from '@/form/schemas/cms.schema';
import { formatNpr } from '@/helpers/format';
import { linkIssue } from '@/helpers/links';
import { offerWindow } from '@/helpers/schedule';

const TONE = { live: 'success', scheduled: 'info', ended: 'muted' };
const WORD = { live: 'Live', scheduled: 'Scheduled', ended: 'Ended' };

const schema = ({ pageSlugs }) => offerSchema.superRefine((v, ctx) => {
  const issue = linkIssue(v.ctaUrl, pageSlugs);
  if (issue) ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: issue });
  if (v.priceMin != null && v.priceMax != null && v.priceMax < v.priceMin) {
    ctx.addIssue({ code: 'custom', path: ['priceMax'], message: 'The “to” price must be at least the “from” price' });
  }
});

function priceRange(r) {
  if (r.priceMin == null) return '—';
  if (r.priceMax == null || r.priceMax === r.priceMin) return formatNpr(r.priceMin, { compact: true });
  return `${formatNpr(r.priceMin, { compact: true })} – ${formatNpr(r.priceMax, { compact: true, symbol: false })}`;
}

/** @type {import('../resourceRegistry').ResourceEntry} */
export const offers = {
  resource: 'offers',
  path: '/admin/offers',
  model: 'offer',
  label: 'Offer',
  labelPlural: 'Offers',
  description: 'Time-limited offers in the “Current offers” band on the home page.',
  notice: 'An offer shows on the home page while it is switched on and its dates include today. Leave a date empty for no limit on that side.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  sortable: true,
  translatable: ['title', 'badge', 'description', 'ctaLabel'],
  titleOf: (record) => record.title,
  publicHref: (record) => (offerWindow(record).status === 'live' ? '/' : null),
  searchPlaceholder: 'Search offers…',
  emptyTitle: 'No offers yet',
  emptyDescription: 'A seasonal offer with an end date gives a visitor a reason to book now.',

  columns: [
    {
      key: 'title', header: 'Offer', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium font-deva">{r.title}</span>
            {r.badge ? <Badge variant="goldSoft" className="shrink-0 text-[10px]">{r.badge}</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{r.description}</p>
        </div>
      ),
    },
    {
      key: 'endsAt', header: 'Dates', sortable: true,
      cell: (r) => {
        const { status, label } = offerWindow(r);
        return (
          <div className="space-y-0.5">
            <StateBadge tone={TONE[status]}>{WORD[status]}</StateBadge>
            <p className="whitespace-nowrap text-xs text-muted-foreground">{label}</p>
          </div>
        );
      },
    },
    {
      key: 'priceMin', header: 'Price', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-sm tabular-nums">{priceRange(r)}</span>,
    },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250, description: 'English or Nepali — the site sets it in the Devanagari face either way.' },
    { name: 'badge', type: 'text', label: 'Badge', span: 'half', maxLength: 60, placeholder: 'Limited Time' },
    { name: 'imageId', type: 'media', label: 'Picture', span: 'half' },
    { name: 'description', type: 'textarea', label: 'Description', rows: 3 },
    { name: 'bullets', type: 'stringList', label: 'What is included', addLabel: 'Add a line', maxItems: 50 },
    {
      type: 'group', label: 'Price and dates', defaultOpen: true,
      description: 'The price is a range in rupees. The dates are Nepal time.',
      fields: [
        { name: 'priceMin', type: 'money', label: 'Price from', span: 'half' },
        { name: 'priceMax', type: 'money', label: 'Price to', span: 'half' },
        { name: 'startsAt', type: 'datetime', label: 'Starts', span: 'half', defaultTime: '00:00', description: 'Empty: live now.' },
        { name: 'endsAt', type: 'datetime', label: 'Ends', span: 'half', defaultTime: '23:59', description: 'Empty: no end. A picked day ends at 23:59.' },
      ],
    },
    { name: 'ctaLabel', type: 'text', label: 'Button text', span: 'half', maxLength: 60, placeholder: 'Book now' },
    { name: 'ctaUrl', type: 'text', label: 'Button link', span: 'half', maxLength: 500, placeholder: '/book', description: 'A page of this site or a tel: / https:// link.' },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true, ctaUrl: '/book' },
};
