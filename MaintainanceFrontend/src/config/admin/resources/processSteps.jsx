import { DataIcon } from '@/components/site/DataIcon';
import { processStepSchema } from '@/form/schemas/cms.schema';
import { formatDate } from '@/helpers/format';
import { ICON_OPTIONS } from './iconOptions';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const processSteps = {
  resource: 'process-steps',
  path: '/admin/process-steps',
  model: 'processStep',
  label: 'Process step',
  labelPlural: 'Process steps',
  description: 'The “how it works” steps on the home page, shown in step-number order.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: processStepSchema,
  // The site orders these by stepNo, not sortOrder, so drag-to-reorder would change nothing a visitor sees.
  sortable: false,
  translatable: ['title', 'description'],
  titleOf: (record) => record.title,
  publicHref: () => '/',
  searchPlaceholder: 'Search steps…',
  emptyTitle: 'No process steps yet',
  emptyDescription: 'Explain what happens between a customer’s first call and the warranty.',

  columns: [
    {
      key: 'stepNo', header: 'Step', sortable: true, className: 'w-16',
      cell: (r) => <span className="font-mono text-sm font-semibold tabular-nums">{String(r.stepNo).padStart(2, '0')}</span>,
    },
    {
      key: 'title', header: 'Title', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 max-w-xl items-center gap-3">
          <DataIcon name={r.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title}</p>
            <p className="truncate text-xs text-muted-foreground">{r.description}</p>
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
    { name: 'stepNo', type: 'number', label: 'Step number', required: true, min: 1, max: 50, step: 1, span: 'half' },
    { name: 'icon', type: 'select', label: 'Icon', span: 'half', options: ICON_OPTIONS, noneLabel: 'Default icon' },
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
    { name: 'description', type: 'textarea', label: 'Description', rows: 3 },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true },
};
