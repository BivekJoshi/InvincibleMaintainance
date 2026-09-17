import { jobTemplateSchema } from '@/form/schemas/ops.schema';
import { formatDate } from '@/helpers/format';
import { inUseCopy } from './inUseCopy';

const SERVICE_RELATION = { path: '/admin/services', labelKey: 'name' };

/**
 * A named checklist. Picking a template on a new job copies its steps onto the job; changing the
 * template later does not change jobs already made from it.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const jobTemplates = {
  resource: 'job-templates',
  path: '/admin/job-templates',
  basePath: '/admin/job-templates',
  model: 'jobTemplate',
  label: 'Job template',
  labelPlural: 'Job templates',
  description: 'Standard checklists a new job starts from.',
  notice: 'A job copies its template’s steps when it is created. Editing a template changes only jobs created after that.',
  activeCopy: inUseCopy('Jobs made from it keep their checklist.'),
  capability: 'jobs:read',
  writeCapability: 'jobs:write',
  schema: jobTemplateSchema,
  sortable: false,
  defaultSort: 'name',
  titleOf: (record) => record.name,
  publicHref: () => null,
  searchPlaceholder: 'Search templates…',
  emptyTitle: 'No job templates yet',
  emptyDescription: 'Write down the steps your best technician follows, once.',

  columns: [
    {
      key: 'name', header: 'Template', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.service?.name ?? 'Any service'}</p>
        </div>
      ),
    },
    {
      key: 'tasks', header: 'Steps', className: 'text-right',
      cell: (r) => <span className="tabular-nums">{Array.isArray(r.tasks) ? r.tasks.length : 0}</span>,
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  filters: [
    { key: 'serviceId', label: 'Service', type: 'relation', relation: SERVICE_RELATION },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 200, placeholder: 'Seepage treatment — standard checklist' },
    { name: 'serviceId', type: 'relation', label: 'Service', relation: SERVICE_RELATION, description: 'Optional — the service this checklist is for.' },
    { name: 'description', type: 'textarea', label: 'Description', rows: 2 },
    {
      name: 'tasks', type: 'objectList', label: 'Steps', required: true, maxItems: 100, addLabel: 'Add a step',
      itemLabel: 'Step',
      itemFields: [
        { name: 'title', label: 'Step', placeholder: 'Take moisture-meter readings', maxLength: 300 },
        { name: 'description', label: 'How (optional)', placeholder: 'Three readings per wall, at 30 cm', maxLength: 1000 },
      ],
      description: 'In the order they are done. The technician ticks each one off.',
    },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired templates are not offered on new jobs.' },
  ],

  defaultValues: { isActive: true, tasks: [{ title: '', description: '' }] },
};
