import { Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from '@/components/common/StateBadge';
import { ProjectGalleryTab } from '@/components/projects/ProjectGalleryTab';
import { projectSchema } from '@/form/schemas/cms.schema';
import { formatNpr } from '@/helpers/format';

const STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'ongoing', label: 'Ongoing' },
];

/** The band is published; it is checked here because a reversed band reads as nonsense on the site. */
const schema = projectSchema.superRefine((v, ctx) => {
  if (v.costBandMin != null && v.costBandMax != null && v.costBandMax < v.costBandMin) {
    ctx.addIssue({ code: 'custom', path: ['costBandMax'], message: 'The top of the band must be at least the bottom' });
  }
});

/** "Rs. 1,20,000–3,50,000", or "—". */
function band(r) {
  if (r.costBandMin == null) return '—';
  const max = r.costBandMax ?? r.costBandMin;
  return `${formatNpr(r.costBandMin, { compact: true })}–${formatNpr(max, { compact: true, symbol: false })}`;
}

/** @type {import('../resourceRegistry').ResourceEntry} */
export const projects = {
  resource: 'projects',
  path: '/admin/projects',
  model: 'project',
  label: 'Project',
  labelPlural: 'Projects',
  description: 'Case studies: the problem, what we did, how it ended — with photographs.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  sortable: true,
  translatable: ['title', 'location', 'summary', 'problem', 'solution', 'outcome', 'body'],
  titleOf: (record) => record.title,
  publicHref: (record) => `/projects/${record.slug}`,
  searchPlaceholder: 'Search projects, places, clients…',
  emptyTitle: 'No projects yet',
  emptyDescription: 'Publish finished work — it is the proof a customer looks for before they call.',

  columns: [
    {
      key: 'title', header: 'Project', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            <span className="truncate">{r.title}</span>
            {r.isFeatured ? <Badge variant="secondary" className="shrink-0 text-[10px]">Featured</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[r.service?.name ?? r.category?.name, r.location].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true,
      cell: (r) => (r.status === 'ongoing'
        ? <StateBadge tone="info">Ongoing</StateBadge>
        : <StateBadge tone="success">Completed</StateBadge>),
    },
    {
      key: 'images', header: 'Pictures',
      cell: (r) => <span className="text-sm tabular-nums">{r.images?.length ?? 0}</span>,
    },
    {
      key: 'costBandMin', header: 'Cost band', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-sm tabular-nums">{band(r)}</span>,
    },
  ],

  filters: [
    { key: 'serviceId', label: 'Service', type: 'relation', relation: { path: '/admin/services', labelKey: 'name' } },
    { key: 'categoryId', label: 'Category', type: 'relation', relation: { path: '/admin/service-categories', labelKey: 'name' } },
    { key: 'status', label: 'Status', type: 'enum', allLabel: 'Any status', options: STATUSES },
  ],

  intro: (record) => (record.job ? (
    <p className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <Briefcase className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>Published from job <strong className="font-mono">{record.job.number}</strong>. The link to the job cannot be changed here.</span>
    </p>
  ) : null),

  tabs: [{ value: 'gallery', label: 'Gallery', component: ProjectGalleryTab }],

  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
    {
      name: 'slug', type: 'slug', label: 'URL name', source: 'title', prefix: '/projects/',
      description: 'The page address. Changing it breaks links people have saved.',
    },
    {
      name: 'serviceId', type: 'relation', label: 'Service', span: 'half',
      relation: { path: '/admin/services', labelKey: 'name' },
      description: 'Shows this project on that service’s page.',
    },
    {
      name: 'categoryId', type: 'relation', label: 'Category', span: 'half',
      relation: { path: '/admin/service-categories', labelKey: 'name' },
    },
    { name: 'status', type: 'select', label: 'Status', span: 'half', required: true, options: STATUSES },
    { name: 'location', type: 'text', label: 'Location', span: 'half', maxLength: 200, placeholder: 'Bhaisepati, Lalitpur' },
    {
      name: 'clientName', type: 'text', label: 'Client name', maxLength: 160,
      description: 'Only with the customer’s written consent to be named — otherwise leave it empty, or describe them (“Private residence”). Our case studies name our work, not our customers.',
    },
    {
      name: 'summary', type: 'textarea', label: 'Summary', rows: 2,
      description: 'One or two sentences under the title on the project page.',
    },
    {
      type: 'group', label: 'The story', defaultOpen: true,
      description: 'Problem → what we did → result. The page leaves out any part that is empty.',
      fields: [
        { name: 'problem', type: 'textarea', label: 'The problem', rows: 4, description: 'Also the card text on the projects list.' },
        { name: 'solution', type: 'textarea', label: 'What we did', rows: 4 },
        { name: 'outcome', type: 'textarea', label: 'How it ended', rows: 3 },
        { name: 'body', type: 'textarea', label: 'More detail', rows: 4 },
      ],
    },
    {
      type: 'group', label: 'Facts', defaultOpen: true,
      description: 'The cost is a band in rupees, never the customer’s contract value.',
      fields: [
        { name: 'costBandMin', type: 'money', label: 'Cost from', span: 'half' },
        { name: 'costBandMax', type: 'money', label: 'Cost to', span: 'half' },
        { name: 'durationDays', type: 'number', label: 'Days on site', span: 'half', min: 0, max: 3650, step: 1 },
        { name: 'completedAt', type: 'date', label: 'Completed on', span: 'half' },
      ],
    },
    { name: 'coverId', type: 'media', label: 'Cover picture', description: 'On the project card. Without one, the first gallery picture is used.' },
    { name: 'isFeatured', type: 'switch', label: 'Featured', span: 'half', description: 'Marks it in this list. No public page treats featured projects differently yet.' },
    { name: 'isActive', type: 'switch', label: 'Show on the website', span: 'half' },
    {
      name: 'publishedAt', type: 'date', label: 'Published on', span: 'half',
      description: 'For your records; the switch above decides whether it is on the site.',
    },
    {
      type: 'group', label: 'Search engines', description: 'Optional. The title and the problem are used when these are empty.',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Page title', maxLength: 180 },
        { name: 'metaDescription', type: 'textarea', label: 'Description', rows: 2, maxLength: 400 },
      ],
    },
  ],

  defaultValues: { status: 'completed', isActive: true, isFeatured: false },
};
