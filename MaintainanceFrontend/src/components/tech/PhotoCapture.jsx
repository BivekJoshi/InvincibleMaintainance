import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, CloudUpload, ImageIcon, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { compressImage } from '@/helpers/compressImage';
import { getUpload } from '@/helpers/uploadQueue';
import { sentFor, thumbFor } from '@/helpers/sentPhotos';
import { formatTime, imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { selectFieldSync } from '@/redux/slices/fieldSyncSlice';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/** A queued picture's bytes as an object URL, released when the tile goes. */
function usePendingPicture(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getUpload(id).then((entry) => {
      if (!alive || !entry?.file || typeof URL?.createObjectURL !== 'function') return;
      objectUrl = URL.createObjectURL(entry.file);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}

function Tile({ src, kindLabel, caption, at, badge, pending }) {
  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        {src ? (
          <img src={src} alt={caption || kindLabel || ''} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" aria-hidden /></div>
        )}
        {badge ? (
          <span className={cn(
            'absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            pending ? 'surface-warning border' : 'bg-background/90',
          )}
          >
            {pending ? <CloudUpload className="h-3 w-3" aria-hidden /> : null}{badge}
          </span>
        ) : null}
      </div>
      <div className="px-2 py-1.5 text-xs">
        {kindLabel ? <p className="font-medium">{kindLabel}</p> : null}
        {caption ? <p className="truncate text-muted-foreground">{caption}</p> : null}
        {at ? <p className="text-muted-foreground">{formatTime(at)}</p> : null}
      </div>
    </li>
  );
}

function PendingTile({ upload, badge, kindLabel }) {
  const src = usePendingPicture(upload.id);
  return <Tile src={src} kindLabel={kindLabel} caption={upload.caption} at={upload.at} badge={badge} pending />;
}

/**
 * Take a picture and queue it (`hooks/useOfflineQueue#useFieldQueue`) — for a job (`target="job"`, with the
 * kind picker) or a survey (`target="survey"`, filed by the API as ISSUE). The camera input opens the rear
 * camera on a phone; each picture is compressed (`helpers/compressImage.js`) and queued, and shows at once as
 * a thumbnail marked "Waiting to upload" until it is on the server.
 *
 * Below the queued ones: the photos on the server (`photos`, with their images from `media` — the field API
 * sends both for a job and for a survey since Phase H2); a photo this phone sent a moment ago but the page has
 * not refetched yet falls back to the thumbnail remembered from its upload.
 *
 * @param {{ target: 'job'|'survey', targetId: string, kinds?: string[], defaultKind?: string,
 *   photos?: Array<{ id: string, mediaId: string, kind: string, caption?: string, createdAt?: string }>,
 *   media?: Record<string, object>, readOnly?: boolean, copy: object }} props  `copy` is the field copy
 *   (`config/tech/fieldCopy.js`)
 */
export function PhotoCapture({ target, targetId, kinds = [], defaultKind, photos, media = {}, readOnly = false, copy }) {
  const dispatch = useDispatch();
  const { queueUpload } = useFieldQueue();
  const { uploads, syncing, online } = useSelector(selectFieldSync);
  const [kind, setKind] = useState(defaultKind ?? kinds[0]);
  const [caption, setCaption] = useState('');
  const [preparing, setPreparing] = useState(0);
  const words = copy.photos;

  const waiting = useMemo(
    () => uploads.filter((u) => u.target === target && u.targetId === targetId).slice().reverse(),
    [uploads, target, targetId],
  );
  // What the server has, with its images; before the page first loads them, what this phone sent.
  const sent = photos
    ? [...photos].reverse().map((p) => ({
      key: p.id, src: imageUrl(media[p.mediaId], 400) ?? thumbFor(p.mediaId), kind: p.kind, caption: p.caption, at: p.createdAt,
    }))
    : sentFor(target, targetId).map((p) => ({ key: p.mediaId, src: p.thumb, kind: p.kind, caption: p.caption, at: p.at }));

  const onFiles = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = ''; // the same picture may be chosen again
    if (!files.length) return;
    setPreparing((n) => n + files.length);
    let queued = 0;
    for (const file of files) {
      try {
        const small = await compressImage(file);
        await queueUpload({
          target,
          targetId,
          ...(target === 'job' ? { kind } : {}),
          caption,
          file: small,
          name: small.name ?? file.name,
        });
        queued += 1;
      } catch (err) {
        dispatch(toastError(words.failed, err?.message));
      } finally {
        setPreparing((n) => n - 1);
      }
    }
    if (queued) {
      setCaption('');
      if (!navigator.onLine) dispatch(toastSuccess(words.queued(queued)));
    }
  };

  const inputId = `photo-input-${target}-${targetId}`;

  return (
    <div className="space-y-4">
      {!readOnly ? (
        <div className="space-y-3">
          {kinds.length ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium" id={`${inputId}-kind`}>{words.kindLabel}</p>
              <ToggleGroup
                type="single"
                value={kind}
                onValueChange={(v) => v && setKind(v)}
                aria-labelledby={`${inputId}-kind`}
                className="grid grid-cols-2 gap-2"
              >
                {kinds.map((k) => (
                  <ToggleGroupItem
                    key={k}
                    value={k}
                    variant="outline"
                    className="h-12 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {words.kinds[k]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`${inputId}-caption`}>{words.caption}</Label>
            <Input
              id={`${inputId}-caption`}
              value={caption}
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={words.captionPlaceholder}
              className="h-11 text-base"
            />
          </div>
          <label
            className={cn(
              buttonVariants({ size: 'xl' }),
              'w-full cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              preparing ? 'pointer-events-none opacity-70' : '',
            )}
          >
            {preparing ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            {preparing ? words.preparing : words.take}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={onFiles}
              aria-label={words.take}
            />
          </label>
        </div>
      ) : null}

      {waiting.length || sent.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={words.title}>
          {waiting.map((u) => (
            <PendingTile
              key={u.id}
              upload={u}
              kindLabel={u.kind ? words.kinds[u.kind] : null}
              badge={syncing && online ? words.uploading : words.waiting}
            />
          ))}
          {sent.map((p) => (
            <Tile key={p.key} src={p.src} kindLabel={p.kind ? words.kinds[p.kind] : null} caption={p.caption} at={p.at} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{words.none}</p>
      )}
    </div>
  );
}
