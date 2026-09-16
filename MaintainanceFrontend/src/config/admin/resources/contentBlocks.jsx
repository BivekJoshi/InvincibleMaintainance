import { contentBlockSchema } from '@/form/schemas/cms.schema';
import { linkIssue } from '@/helpers/links';
import { z } from 'zod';

/**
 * The keys the site looks blocks up by. A block under any other key is kept but shown
 * nowhere, so the key is picked from this list, and fixed once the block exists.
 */
export const CONTENT_BLOCK_KEYS = [
  { value: 'seepage_explainer', label: 'Seepage & cracks band (home page)', shown: true },
  { value: 'interior_design', label: 'Interiors band (home page)', shown: true },
  { value: 'about_intro', label: 'About introduction (not shown yet)', shown: false },
  { value: 'cta_banner', label: 'Call-to-action banner (not shown yet)', shown: false },
];
const SHOWN = new Set(CONTENT_BLOCK_KEYS.filter((k) => k.shown).map((k) => k.value));
const LABEL = Object.fromEntries(CONTENT_BLOCK_KEYS.map((k) => [k.value, k.label]));

/** An empty button is `{ label: '', url: '' }`, which the site skips; half a button is refused. */
const cta = z.preprocess(
  (v) => ({ label: String(v?.label ?? '').trim(), url: String(v?.url ?? '').trim() }),
  z.object({ label: z.string().max(60, 'Keep it to 60 characters'), url: z.string().max(500) }),
);

const schema = ({ pageSlugs }) => contentBlockSchema.extend({ cta }).superRefine((v, ctx) => {
  if (v.cta.label && !v.cta.url) ctx.addIssue({ code: 'custom', path: ['cta', 'url'], message: 'Where does the button go?' });
  if (v.cta.url && !v.cta.label) ctx.addIssue({ code: 'custom', path: ['cta', 'label'], message: 'What does the button say?' });
  const issue = linkIssue(v.cta.url, pageSlugs);
  if (issue) ctx.addIssue({ code: 'custom', path: ['cta', 'url'], message: issue });
});

/** @type {import('../resourceRegistry').ResourceEntry} */
export const contentBlocks = {
  resource: 'content-blocks',
  path: '/admin/content-blocks',
  model: 'contentBlock',
  label: 'Content block',
  labelPlural: 'Content blocks',
  description: 'The written bands of the home page — a heading, a paragraph, bullets, a picture and a button.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema,
  // The site finds a block by its key; the list order shows nowhere.
  sortable: false,
  translatable: ['heading', 'subheading', 'body'],
  titleOf: (record) => record.heading || LABEL[record.key] || record.key,
  publicHref: (record) => (SHOWN.has(record.key) ? '/' : null),
  searchPlaceholder: 'Search blocks…',
  emptyTitle: 'No content blocks yet',
  emptyDescription: 'Each written band of the home page is one block.',

  columns: [
    {
      key: 'heading', header: 'Block',
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <p className="truncate font-medium">{r.heading || '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{r.subheading || r.body}</p>
        </div>
      ),
    },
    {
      key: 'key', header: 'Where', sortable: true,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="text-sm">{LABEL[r.key] ?? 'Not shown on the site'}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{r.key}</p>
        </div>
      ),
    },
  ],

  fields: [
    {
      name: 'key', type: 'select', label: 'Where it shows', required: true, options: CONTENT_BLOCK_KEYS,
      lockedOnEdit: true,
      description: 'The site finds the block by this, so it cannot change once the block is saved.',
    },
    { name: 'heading', type: 'text', label: 'Heading', maxLength: 250 },
    { name: 'subheading', type: 'textarea', label: 'Subheading', rows: 2, maxLength: 400 },
    { name: 'body', type: 'textarea', label: 'Text', rows: 5, description: 'Shown as one paragraph.' },
    {
      name: 'bullets', type: 'stringList', label: 'Bullets', addLabel: 'Add a bullet', maxItems: 50,
      description: 'The interiors band lists them; the seepage band uses the “Seepage warning signs” list instead. English only for now.',
    },
    { name: 'imageId', type: 'media', label: 'Picture' },
    {
      name: 'cta', type: 'keyValue', label: 'Button', keys: ['label', 'url'],
      keyLabels: { label: 'Text', url: 'Link' }, placeholders: { label: 'Book a free inspection', url: '/book' },
      description: 'Leave both empty for no button.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true },
};
