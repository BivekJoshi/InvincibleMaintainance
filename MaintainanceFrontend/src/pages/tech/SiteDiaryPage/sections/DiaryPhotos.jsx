import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, CloudUpload, ImageIcon, Loader2, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { usePendingPicture } from '@/hooks/usePendingPicture';
import { compressImage } from '@/helpers/compressImage';
import { newKey } from '@/helpers/fieldDb';
import { mediaIdForUpload, thumbFor } from '@/helpers/sentPhotos';
import { imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { selectFieldUploads } from '@/redux/slices/fieldSyncSlice';
import { toastError } from '@/redux/slices/uiSlice';
import { MAX_PHOTOS } from '../siteDiary';

function PhotoTile({ photo, n, media, uploads, onRemove, readOnly, words }) {
  const waiting = Boolean(photo.uploadId && uploads.some((u) => u.id === photo.uploadId));
  const mediaId = photo.mediaId ?? (photo.uploadId && !waiting ? mediaIdForUpload(photo.uploadId) : null);
  const pendingSrc = usePendingPicture(waiting ? photo.uploadId : null);
  const src = pendingSrc ?? (mediaId ? imageUrl(media?.[mediaId], 400) ?? thumbFor(mediaId) : null);
  return (
    <li className="overflow-hidden rounded-lg border bg-card" data-testid="diary-photo" data-waiting={waiting ? 'true' : 'false'}>
      <div className="relative aspect-[4/3] bg-muted">
        {src ? <img src={src} alt={words.photo(n)} className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" aria-hidden /></div>
        )}
        {!readOnly ? (
          <Button
            type="button" variant="secondary" size="icon" className="absolute right-1 top-1 h-11 w-11 rounded-full"
            onClick={onRemove} aria-label={words.remove(n)}
          >
            <X />
          </Button>
        ) : null}
      </div>
      <p className={cn('flex items-center gap-1 px-2 py-1.5 text-xs font-medium', waiting ? 'text-warning' : 'text-success')}>
        {waiting ? <CloudUpload className="h-3.5 w-3.5" aria-hidden /> : null}
        {waiting ? words.waiting : words.sent}
      </p>
    </li>
  );
}

/**
 * The day's photos: taken with the rear camera, shrunk and put in the upload queue as the job's DURING photos
 * (`useFieldQueue#queueUpload`), captioned with the day. The day names each by its upload until it is on the server;
 * the sync engine sends the day with the media ids (`useOfflineQueue#resolveDiaryPhotos`) — so a day saved offline
 * waits for its pictures, and is never sent without them.
 */
export function DiaryPhotos({ jobId, day, photos, media, onChange, problem, readOnly, words }) {
  const t = words.photos;
  const dispatch = useDispatch();
  const { queueUpload } = useFieldQueue();
  const uploads = useSelector(selectFieldUploads);
  const [preparing, setPreparing] = useState(0);
  const full = photos.length >= MAX_PHOTOS;
  const inputId = `diary-photo-${jobId}-${day}`;

  const onFiles = async (event) => {
    const files = [...(event.target.files ?? [])].slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    event.target.value = '';
    if (!files.length) return;
    setPreparing((n) => n + files.length);
    const added = [];
    for (const file of files) {
      try {
        const small = await compressImage(file);
        const entry = await queueUpload({
          target: 'job', targetId: jobId, kind: 'DURING', caption: t.caption(day), file: small, name: small.name ?? file.name,
        });
        added.push({ _key: newKey(), uploadId: entry.id });
      } catch (err) {
        dispatch(toastError(t.failed, err?.message));
      } finally {
        setPreparing((n) => n - 1);
      }
    }
    if (added.length) onChange([...photos, ...added]);
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 pb-4">
        {photos.length ? (
          <ul className="grid grid-cols-2 gap-2" aria-label={t.title}>
            {photos.map((photo, i) => (
              <PhotoTile
                key={photo._key}
                photo={photo}
                n={i + 1}
                media={media}
                uploads={uploads}
                readOnly={readOnly}
                words={t}
                onRemove={() => onChange(photos.filter((p) => p._key !== photo._key))}
              />
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t.none}</p>}
        {problem ? <p className="text-sm font-medium text-destructive">{t[problem]}</p> : null}
        {!readOnly ? (
          <label
            className={cn(
              buttonVariants({ size: 'xl', variant: 'outline' }),
              'relative w-full cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              preparing || full ? 'pointer-events-none opacity-70' : '',
            )}
          >
            {preparing ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            {preparing ? t.preparing : full ? t.max : t.take}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={full}
              onChange={onFiles}
              aria-label={t.take}
            />
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
