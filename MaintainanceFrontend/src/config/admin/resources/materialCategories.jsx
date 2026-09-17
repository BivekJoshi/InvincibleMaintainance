import { materialCategorySchema } from '@/form/schemas/ops.schema';
import { formatDate } from '@/helpers/format';
import { inUseCopy } from './inUseCopy';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const materialCategories = {
  resource: 'material-categories',
  path: '/admin/material-categories',
  basePath: '/admin/material-categories',
  model: 'materialCategory',
  label: 'Material category',
  labelPlural: 'Material categories',
  description: 'Groups for the materials list and the stock page.',
  activeCopy: inUseCopy('Materials in it keep it.'),
  capability: 'materials:read',
  writeCapability: 'materials:write',
  schema: materialCategorySchema,
  sortable: true,
  titleOf: (record) => record.name,
  publicHref: () => null,
  searchPlaceholder: 'Search categories…',
  emptyTitle: 'No material categories yet',
  emptyDescription: 'A handful is enough — waterproofing, plumbing, electrical, finishing.',

  columns: [
    { key: 'name', header: 'Category', sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 120 },
    { name: 'isActive', type: 'switch', label: 'In use' },
  ],

  defaultValues: { isActive: true },
};
