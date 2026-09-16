import { Badge } from '@/components/ui/badge';
import { listItemSchema } from '@/form/schemas/cms.schema';

/** The numbered lists the home page reads, and where each one shows. */
export const LIST_GROUP_OPTIONS = [
  { value: 'renovation_reasons', label: 'Renovation reasons' },
  { value: 'kitchen_steps', label: 'Kitchen steps' },
  { value: 'seepage_checkpoints', label: 'Seepage warning signs' },
];
const GROUP_LABEL = Object.fromEntries(LIST_GROUP_OPTIONS.map((g) => [g.value, g.label]));

/**
 * A numbered list item. Its `position` is the number the site prints beside it, so
 * reordering only means something within one list: Reorder waits for a group filter,
 * and then numbers that list 1, 2, 3… (the API adds one to the table's index).
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const listItems = {
  resource: 'list-items',
  path: '/admin/list-items',
  model: 'listItem',
  label: 'List item',
  labelPlural: 'List items',
  description: 'The numbered lists on the home page: renovation reasons, kitchen steps, seepage warning signs.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: listItemSchema,
  sortable: true,
  reorderWithin: 'group',
  reorderHint: 'Pick a list to reorder it.',
  translatable: ['text'],
  titleOf: (record) => record.text,
  publicHref: () => '/',
  searchPlaceholder: 'Search list items…',
  emptyTitle: 'No list items here',
  emptyDescription: 'Add the lines of a list, one at a time.',

  columns: [
    {
      key: 'position', header: 'No.', sortable: true, className: 'w-16',
      cell: (r) => <span className="font-mono text-sm font-semibold tabular-nums">{String(r.position).padStart(2, '0')}</span>,
    },
    { key: 'text', header: 'Text', cell: (r) => <p className="max-w-xl truncate">{r.text}</p> },
    {
      key: 'group', header: 'List', sortable: true,
      cell: (r) => <Badge variant="outline" className="whitespace-nowrap">{GROUP_LABEL[r.group] ?? r.group}</Badge>,
    },
  ],

  filters: [
    { key: 'group', label: 'List', type: 'enum', allLabel: 'All lists', options: LIST_GROUP_OPTIONS, className: 'w-[200px]' },
  ],

  fields: [
    { name: 'group', type: 'select', label: 'List', required: true, span: 'half', options: LIST_GROUP_OPTIONS },
    {
      name: 'position', type: 'number', label: 'Number', required: true, span: 'half', min: 1, max: 999, step: 1,
      description: 'Its number in the list. Reorder the list to renumber it.',
    },
    { name: 'text', type: 'textarea', label: 'Text', required: true, rows: 2, maxLength: 1000 },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { group: 'renovation_reasons', position: 1, isActive: true },
};
