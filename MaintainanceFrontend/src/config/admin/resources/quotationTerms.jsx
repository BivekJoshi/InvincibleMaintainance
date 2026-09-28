import { StateBadge } from '@/components/common/StateBadge';
import { quotationTermsSchema } from '@/form/schemas/quotation.schema';
import { inUseCopy } from './inUseCopy';

/**
 * The terms library (Phase L4) — reusable quotation terms: a title, the English text and, for a customer who reads
 * Nepali, the Nepali text beside it (a column of its own, `bodyNe`, so both are edited on one form). Exactly one entry
 * is the **default**: every new quotation starts with its English text, and saving another as the default moves the
 * flag. The builder's Payment & terms tab inserts any entry. Read with `rates:read` (the API also lets
 * `quotations:read` list it, for the builder's picker); written with `rates:write` — the manager's, like the rates.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const quotationTerms = {
  resource: 'quotation-terms',
  path: '/admin/quotation-terms',
  basePath: '/admin/quotation-terms',
  model: 'quotationTerms',
  label: 'Terms',
  labelPlural: 'Terms library',
  description: 'The terms a quotation is sent with — in English and Nepali.',
  notice: 'A new quotation starts with the default terms. Changing an entry here never changes a quotation already written: the builder copies the text in.',
  activeCopy: inUseCopy('Quotations that use its text keep it.'),
  capability: 'rates:read',
  writeCapability: 'rates:write',
  schema: quotationTermsSchema,
  sortable: true,
  titleOf: (record) => record.title,
  publicHref: () => null,
  searchPlaceholder: 'Search title or text…',
  emptyTitle: 'No terms yet',
  emptyDescription: 'Write the terms your quotations are sent with — payment, validity, warranty, what the customer provides.',

  columns: [
    {
      key: 'title', header: 'Title', sortable: true,
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{r.title}</span>
          {r.isDefault ? <StateBadge tone="info">Default</StateBadge> : null}
        </div>
      ),
    },
    {
      key: 'body', header: 'Text',
      cell: (r) => <p className="line-clamp-2 max-w-md text-xs text-muted-foreground">{r.body}</p>,
    },
    {
      key: 'bodyNe', header: 'Nepali',
      cell: (r) => (r.bodyNe ? <span lang="ne" className="text-xs">नेपाली ✓</span> : <span className="text-xs text-muted-foreground">English only</span>),
      exportValue: (r) => (r.bodyNe ? 'yes' : 'no'),
    },
  ],

  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 120, placeholder: 'Standard repair terms', description: 'For the office — the customer never sees it.' },
    {
      name: 'isDefault', type: 'switch', label: 'Default for new quotations',
      description: 'Every new quotation starts with this entry’s English text. Only one entry is the default: this takes the flag from the others.',
    },
    {
      name: 'body', type: 'textarea', label: 'Terms (English)', required: true, rows: 10, maxLength: 8000,
      placeholder: '50% advance on acceptance, 40% as the work progresses, 10% on completion.\nMaterials are guaranteed as per the manufacturer…',
    },
    {
      name: 'bodyNe', type: 'textarea', label: 'Terms (नेपाली)', rows: 10, maxLength: 8000, lang: 'ne', nullable: true,
      description: 'Optional. For a customer who reads Nepali, the builder offers this text instead.',
    },
    { name: 'isActive', type: 'switch', label: 'In use', description: 'Retired terms are not offered in the builder.' },
  ],

  defaultValues: { isActive: true, isDefault: false },
};
