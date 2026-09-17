import { useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { MediaThumb } from '@/components/common/MediaPicker/MediaThumb';
import { mediaUpdateSchema } from '@/form/schemas/cms.schema';
import { formatBytes, formatDateTime } from '@/helpers/format';

/** A stored path as a full address someone can paste anywhere. */
const absolute = (url) => (url ? new URL(url, window.location.origin).href : '');

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={label}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy URL'}
    </Button>
  );
}

function MediaFacts({ media }) {
  const variants = Object.entries(media.variants ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <div className="space-y-6">
      <div className="aspect-video overflow-hidden rounded-lg border">
        <MediaThumb media={{ ...media, thumb: media.variants?.['800'] ?? media.thumb }} className="[&_img]:object-contain" />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Dimensions</dt>
        <dd className="tabular-nums">{media.width && media.height ? `${media.width} × ${media.height} px` : '—'}</dd>
        <dt className="text-muted-foreground">File</dt>
        <dd className="tabular-nums">{media.mime} · {formatBytes(media.size)}</dd>
        <dt className="text-muted-foreground">Variants</dt>
        <dd>
          {variants.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {variants.map(([width, url]) => (
                <li key={width}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="rounded border px-1.5 py-0.5 font-mono text-xs hover:bg-muted">
                    {width}w
                  </a>
                </li>
              ))}
            </ul>
          ) : '—'}
        </dd>
      </dl>

      <div className="space-y-2">
        <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{absolute(media.url)}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={absolute(media.url)} label="Copy the file’s URL" />
          <Button asChild variant="outline" size="sm">
            <a href={media.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Open original</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One file of the media library, as a `ResourceForm` sheet: the picture, what the API made
 * of it (dimensions, size, WebP variants) and its address above a form for alt text,
 * caption and folder. Closing with unsaved changes asks first, like every form sheet.
 *
 * @param {object} props
 * @param {object|null} props.media         the row from the grid; the sheet is open while it is set
 * @param {object[]} props.folders
 * @param {boolean} props.canWrite
 * @param {boolean} props.canPurge
 * @param {() => void} props.onClose
 * @param {(body: object) => Promise<unknown>} props.onSave
 * @param {(opts: { hard: boolean }) => void} props.onDelete
 */
export function MediaDetailsSheet({ media, folders, canWrite, canPurge, onClose, onSave, onDelete }) {
  // The last file shown stays in the sheet while it animates closed.
  const last = useRef(media);
  if (media) last.current = media;
  const shown = media ?? last.current;

  const fields = [
    {
      name: 'alt', type: 'text', label: 'Alt text', required: true, maxLength: 300,
      description: 'What the picture shows, for screen readers and search engines.',
    },
    { name: 'caption', type: 'textarea', label: 'Caption', rows: 2, maxLength: 500 },
    {
      name: 'folderId', type: 'select', label: 'Folder', noneLabel: 'No folder',
      options: folders.map((f) => ({ value: f.id, label: f.name })),
    },
  ];

  return (
    <ResourceForm
      key={shown?.id ?? 'none'}
      mode="sheet"
      open={Boolean(media)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={shown?.alt || 'Image without alt text'}
      description={shown ? `Uploaded ${formatDateTime(shown.createdAt)}` : undefined}
      schema={mediaUpdateSchema}
      fields={fields}
      defaultValues={shown ?? undefined}
      intro={shown ? <MediaFacts media={shown} /> : null}
      onSubmit={(body) => onSave({ ...body, folderId: body.folderId ?? null })}
      submitLabel="Save"
      cancelLabel="Close"
      readOnly={!canWrite}
      extraActions={canWrite ? (
        <div className="mr-auto flex gap-2">
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onDelete({ hard: false })}>
            <Trash2 aria-hidden /> Delete
          </Button>
          {canPurge ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete({ hard: true })}>
              Delete forever
            </Button>
          ) : null}
        </div>
      ) : null}
    />
  );
}
