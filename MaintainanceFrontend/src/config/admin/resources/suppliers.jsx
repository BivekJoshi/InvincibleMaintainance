import { supplierSchema } from '@/form/schemas/ops.schema';
import { inUseCopy } from './inUseCopy';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const suppliers = {
  resource: 'suppliers',
  path: '/admin/suppliers',
  basePath: '/admin/suppliers',
  model: 'supplier',
  label: 'Supplier',
  labelPlural: 'Suppliers',
  description: 'Who we buy materials from.',
  activeCopy: inUseCopy('Materials that name them keep it.'),
  capability: 'materials:read',
  writeCapability: 'materials:write',
  schema: supplierSchema,
  sortable: false,
  defaultSort: 'name',
  titleOf: (record) => record.name,
  publicHref: () => null,
  searchPlaceholder: 'Search name, phone or email…',
  emptyTitle: 'No suppliers yet',
  emptyDescription: 'Add the shops and dealers you buy from.',

  columns: [
    {
      key: 'name', header: 'Supplier', sortable: true,
      cell: (r) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{r.name}</p>
          {r.address ? <p className="truncate text-xs text-muted-foreground">{r.address}</p> : null}
        </div>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      cell: (r) => (r.phone
        ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:text-primary hover:underline">{r.phone}</a>
        : <span className="text-muted-foreground">—</span>),
    },
    { key: 'email', header: 'Email', cell: (r) => r.email ?? <span className="text-muted-foreground">—</span> },
  ],

  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 160 },
    { name: 'phone', type: 'text', label: 'Phone', span: 'half', inputType: 'tel', placeholder: '9808338255 or 01-5407720' },
    { name: 'email', type: 'text', label: 'Email', span: 'half', inputType: 'email' },
    { name: 'address', type: 'textarea', label: 'Address', rows: 2 },
    { name: 'notes', type: 'textarea', label: 'Notes', rows: 3, description: 'Credit terms, who to ask for, delivery days.' },
    { name: 'isActive', type: 'switch', label: 'In use' },
  ],

  defaultValues: { isActive: true },
};
