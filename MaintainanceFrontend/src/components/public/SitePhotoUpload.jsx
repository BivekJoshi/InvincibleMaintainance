import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { useUploadLeadPhotosMutation } from '@/api/publicApi';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion, useReducedMotion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/** The API's limits, said here so the customer hears them before the upload fails. */
export const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

const isImage = (file) => file.type?.startsWith('image/');

/** One chosen photo while it uploads, and after. */
function Thumb({ item, onRemove, reduced }) {
  const failed = item.status === 'error';
  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      <span
        className={cn(
          'block h-20 w-20 overflow-hidden rounded-xl border bg-muted shadow-[var(--elevation-1)] sm:h-24 sm:w-24',
          failed && 'border-destructive',
        )}
      >
        <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
        {item.status === 'uploading' ? (
          <span className="absolute inset-0 grid place-items-center bg-ink/55 text-ink-foreground">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
            <span className="sr-only">Uploading {item.file.name}</span>
          </span>
        ) : null}
        {failed ? (
          <span className="absolute inset-0 grid place-items-center bg-destructive/75 text-destructive-foreground">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => onRemove(item.key)}
        aria-label={`Remove ${item.file.name}`}
        className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-[var(--elevation-1)] transition-colors hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </motion.li>
  );
}

/**
 * Photos of the site, from the customer's phone. Each one uploads as soon as it is chosen, so
 * the enquiry itself carries only the ids — `onChange` hands them up as they arrive. A photo
 * that fails to upload stays on screen, marked, and is left out of `onChange`; the enquiry is
 * never blocked by it, because a booking matters more than a picture.
 *
 * @param {{ onChange: (ids: string[]) => void, className?: string, compact?: boolean }} props
 */
export function SitePhotoUpload({ onChange, className, compact = false }) {
  const [upload] = useUploadLeadPhotosMutation();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const reduced = useReducedMotion();

  // Object URLs are revoked on the way out, or a long booking session leaks them.
  const previews = useRef(new Set());
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const publish = useCallback((next) => {
    setItems(next);
    onChange?.(next.filter((i) => i.status === 'done').map((i) => i.id));
  }, [onChange]);

  const add = useCallback(async (fileList) => {
    const chosen = [...fileList];
    if (!chosen.length) return;
    setError(null);

    const room = MAX_PHOTOS - items.length;
    const problems = [];
    const usable = [];
    for (const file of chosen) {
      if (!isImage(file)) problems.push(`${file.name} is not a photo`);
      else if (file.size > MAX_BYTES) problems.push(`${file.name} is over 10 MB`);
      else usable.push(file);
    }
    const taking = usable.slice(0, Math.max(0, room));
    if (usable.length > taking.length) problems.push(`Only ${MAX_PHOTOS} photos, so the rest were left out`);
    if (problems.length) setError(problems.join('. '));
    if (!taking.length) return;

    const batch = taking.map((file, i) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: `${Date.now()}-${i}-${file.name}`, file, preview, status: 'uploading' };
    });
    const withBatch = [...items, ...batch];
    publish(withBatch);

    try {
      const saved = await upload(taking).unwrap();
      publish(withBatch.map((item) => {
        const at = batch.indexOf(item);
        return at === -1 ? item : { ...item, status: 'done', id: saved[at]?.id };
      }));
    } catch (err) {
      setError(err?.data?.error?.message ?? 'Those photos did not upload. You can still send the enquiry.');
      publish(withBatch.map((item) => (batch.includes(item) ? { ...item, status: 'error' } : item)));
    }
  }, [items, publish, upload]);

  const remove = (key) => {
    const gone = items.find((i) => i.key === key);
    if (gone) { URL.revokeObjectURL(gone.preview); previews.current.delete(gone.preview); }
    publish(items.filter((i) => i.key !== key));
    setError(null);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    add(event.dataTransfer.files);
  };

  const full = items.length >= MAX_PHOTOS;

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 transition-colors motion-reduce:transition-none',
          dragging ? 'border-primary bg-primary/[0.06]' : 'border-border bg-muted/30',
        )}
      >
        <div className={cn('flex gap-3', compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-center')}>
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ImagePlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Photos of the problem <span className="font-normal text-muted-foreground">(optional)</span></p>
            <p className="text-xs text-muted-foreground">
              A picture of the damp patch, crack or leak helps us price the work before we arrive.
              Up to {MAX_PHOTOS}, 10 MB each.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => inputRef.current?.click()} disabled={full}>
              <ImagePlus className="h-4 w-4" /> Choose photos
            </Button>
            {/* A phone opens the camera; a desktop browser quietly shows the file picker again. */}
            <Button type="button" variant="outline" size="sm" className="rounded-full sm:hidden" onClick={() => cameraRef.current?.click()} disabled={full}>
              <Camera className="h-4 w-4" /> Take one
            </Button>
          </div>
        </div>

        {items.length ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            <AnimatePresence initial={false}>
              {items.map((item) => <Thumb key={item.key} item={item} onRemove={remove} reduced={reduced} />)}
            </AnimatePresence>
          </ul>
        ) : null}

        <input
          ref={inputRef} type="file" accept="image/*" multiple className="sr-only"
          aria-label="Photos of the problem"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
        <input
          ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
          aria-label="Take a photo of the problem"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
      </div>

      {error ? (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}
      {full ? <p className="mt-2 text-xs text-muted-foreground">That is all {MAX_PHOTOS} photos. Remove one to swap it.</p> : null}
    </div>
  );
}
