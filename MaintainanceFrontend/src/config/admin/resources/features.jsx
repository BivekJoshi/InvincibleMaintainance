import { Badge } from '@/components/ui/badge';
import { DataIcon } from '@/components/site/DataIcon';
import { MediaCell } from '@/components/media/MediaCell';
import { featureSchema } from '@/form/schemas/cms.schema';
import { ICON_OPTIONS } from './iconOptions';

/** The groups the home page reads, and the band each one fills. */
export const FEATURE_GROUP_OPTIONS = [
  { value: 'why_choose', label: 'Why choose us (promises)' },
  { value: 'construction', label: 'Construction' },
  { value: 'pre_engineered', label: 'Steel buildings' },
  { value: 'kitchen', label: 'Kitchens' },
];
const GROUP_LABEL = Object.fromEntries(FEATURE_GROUP_OPTIONS.map((g) => [g.value, g.label]));

/** @type {import('../resourceRegistry').ResourceEntry} */
export const features = {
  resource: 'features',
  path: '/admin/features',
  model: 'feature',
  label: 'Feature',
  labelPlural: 'Features',
  description: 'Icon cards in the home page’s promise, construction, steel-building and kitchen bands.',
  notice: 'Each group is one band on the home page, in this list’s order. Filter by a group to arrange it.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: featureSchema,
  sortable: true,
  translatable: ['title', 'description'],
  titleOf: (record) => record.title,
  publicHref: () => '/',
  searchPlaceholder: 'Search features…',
  emptyTitle: 'No features here',
  emptyDescription: 'Add the points each band makes, one card each.',

  columns: [
    {
      key: 'title', header: 'Feature', sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 max-w-xl items-center gap-3">
          {r.imageId ? <MediaCell id={r.imageId} className="h-9 w-12" /> : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <DataIcon name={r.icon} className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title}</p>
            <p className="truncate text-xs text-muted-foreground">{r.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'group', header: 'Band', sortable: true,
      cell: (r) => <Badge variant="outline" className="whitespace-nowrap">{GROUP_LABEL[r.group] ?? r.group}</Badge>,
    },
  ],

  filters: [
    { key: 'group', label: 'Band', type: 'enum', allLabel: 'All bands', options: FEATURE_GROUP_OPTIONS, className: 'w-[200px]' },
  ],

  fields: [
    { name: 'group', type: 'select', label: 'Band', required: true, span: 'half', options: FEATURE_GROUP_OPTIONS },
    { name: 'icon', type: 'select', label: 'Icon', span: 'half', options: ICON_OPTIONS, noneLabel: 'Default icon' },
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
    { name: 'description', type: 'textarea', label: 'Description', rows: 3 },
    {
      name: 'imageId', type: 'media', label: 'Picture',
      description: 'Optional. In a band where any card has a picture, pictures replace the icons; in Kitchens the first picture leads the band.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { group: 'why_choose', isActive: true },
};
