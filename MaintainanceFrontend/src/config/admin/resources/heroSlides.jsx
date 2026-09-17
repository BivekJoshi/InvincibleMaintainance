import { heroSlideSchema } from '@/form/schemas/cms.schema';
import { linkIssue } from '@/helpers/links';
import { formatDate } from '@/helpers/format';

/**
 * The site sends any CTA link it does not serve to the booking page (`siteHref`), so a
 * typo would quietly change where the button goes. The form refuses it instead; a live
 * page (`/about`) is a link the site serves.
 */
const schema = ({ pageSlugs }) => heroSlideSchema.superRefine((v, ctx) => {
  const issue = linkIssue(v.ctaUrl, pageSlugs);
  if (issue) ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: issue });
});

/** @type {import('../resourceRegistry').ResourceEntry} */
export const heroSlides = {
  resource: 'hero-slides',
  path: '/admin/hero-slides',
  model: 'heroSlide',
  label: 'Hero slide',
  labelPlural: 'Hero slides',
  description: 'The headline at the top of the home page.',
  notice: 'The home page shows the first slide that is switched on — its headline, subtitle and button. Reorder to choose which one.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  sortable: true,
  translatable: ['title', 'subtitle', 'ctaLabel'],
  titleOf: (record) => record.title,
  publicHref: () => '/',
  searchPlaceholder: 'Search slides…',
  emptyTitle: 'No hero slides yet',
  emptyDescription: 'Without one, the home page shows its built-in headline.',

  columns: [
    {
      key: 'title', header: 'Headline', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <p className="truncate font-medium">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
        </div>
      ),
    },
    {
      key: 'ctaLabel', header: 'Button',
      cell: (r) => (r.ctaLabel ? (
        <span className="whitespace-nowrap text-sm">{r.ctaLabel} <span className="font-mono text-xs text-muted-foreground">{r.ctaUrl}</span></span>
      ) : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Headline', required: true, maxLength: 250 },
    { name: 'subtitle', type: 'textarea', label: 'Subtitle', rows: 2 },
    { name: 'ctaLabel', type: 'text', label: 'Button text', span: 'half', maxLength: 60, placeholder: 'Book a free inspection' },
    {
      name: 'ctaUrl', type: 'text', label: 'Button link', span: 'half', maxLength: 500, placeholder: '/book',
      description: 'A page of this site, e.g. /book, /services/seepage-treatment or a page such as /about.',
    },
    {
      name: 'imageId', type: 'media', label: 'Image',
      description: 'Kept with the slide; the current home page design draws its own illustration instead.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true, ctaUrl: '/book' },
};
