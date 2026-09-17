import { galleryImageSchema } from '@/form/schemas/cms.schema';
import { MediaCell } from '@/components/media/MediaCell';
import { ProjectName } from '@/components/projects/ProjectName';
import { formatDate } from '@/helpers/format';

/** @type {import('../resourceRegistry').ResourceEntry} */
export const galleryImages = {
  resource: 'gallery',
  path: '/admin/gallery',
  model: 'galleryImage',
  label: 'Gallery picture',
  labelPlural: 'Gallery',
  description: 'The “From the field” mosaic on the home page. The first picture is shown largest.',
  capability: 'cms:read',
  writeCapability: 'cms:write',
  schema: galleryImageSchema,
  sortable: true,
  titleOf: (record) => record.caption || 'Gallery picture',
  publicHref: () => '/',
  searchPlaceholder: 'Search captions…',
  emptyTitle: 'No gallery pictures yet',
  emptyDescription: 'Pick your best site photographs from the media library.',

  columns: [
    {
      key: 'mediaId', header: 'Picture',
      cell: (r) => <MediaCell id={r.mediaId} />,
    },
    {
      key: 'caption', header: 'Caption', sortable: true,
      cell: (r) => <p className="max-w-md truncate">{r.caption || <span className="text-muted-foreground">—</span>}</p>,
    },
    {
      key: 'projectId', header: 'Project',
      cell: (r) => (r.projectId ? <ProjectName id={r.projectId} /> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'updatedAt', header: 'Updated', sortable: true,
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>,
    },
  ],

  filters: [
    { key: 'projectId', label: 'Project', type: 'relation', relation: { path: '/admin/projects', labelKey: 'title' } },
  ],

  fields: [
    { name: 'mediaId', type: 'media', label: 'Picture', required: true },
    {
      name: 'caption', type: 'text', label: 'Caption', maxLength: 300,
      description: 'Shown over the picture on hover, and read out as its description.',
    },
    {
      name: 'projectId', type: 'relation', label: 'Project', relation: { path: '/admin/projects', labelKey: 'title' },
      description: 'Optional: the job this picture is from.',
    },
    { name: 'isActive', type: 'switch', label: 'Show on the website' },
  ],

  defaultValues: { isActive: true },
};
