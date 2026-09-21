import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, Images } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useReducedMotion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The photos full size, one at a time. Arrow keys and the side buttons move through them;
 * Escape closes (the dialog's own behaviour). `at` is the index the viewer opened on.
 */
function Lightbox({ photos, at, onClose, leadName }) {
  const [index, setIndex] = useState(at);
  const reduced = useReducedMotion();
  useEffect(() => setIndex(at), [at]);

  const step = useCallback((by) => setIndex((i) => (i + by + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const photo = photos[index];
  if (!photo) return null;
  const many = photos.length > 1;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl border-ink-foreground/10 bg-ink p-0 text-ink-foreground">
        <DialogTitle className="sr-only">{`Photo ${index + 1} of ${photos.length} from ${leadName}`}</DialogTitle>
        <DialogDescription className="sr-only">Use the left and right arrow keys to move between photos.</DialogDescription>

        <div className="relative flex max-h-[80vh] items-center justify-center overflow-hidden rounded-t-lg bg-ink">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={photo.id}
              src={photo.url}
              alt={photo.caption ?? `Photo ${index + 1} sent by ${leadName}`}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          </AnimatePresence>

          {many ? (
            <>
              <button
                type="button" onClick={() => step(-1)} aria-label="Previous photo"
                className="absolute left-2 grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-ink-foreground backdrop-blur transition-colors hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button" onClick={() => step(1)} aria-label="Next photo"
                className="absolute right-2 grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-ink-foreground backdrop-blur transition-colors hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{photo.caption ?? 'Sent with the enquiry'}</span>
            {many ? <span className="ml-2 tabular-nums text-ink-muted">{index + 1} of {photos.length}</span> : null}
          </p>
          <Button asChild size="sm" variant="outline" className="rounded-full border-ink-foreground/25 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
            <a href={photo.url} target="_blank" rel="noreferrer" download>
              <Download className="h-4 w-4" /> Full size
            </a>
          </Button>
        </div>

        {many ? (
          <div className="flex gap-2 overflow-x-auto border-t border-ink-foreground/10 px-4 py-3 [scrollbar-width:thin]">
            {photos.map((p, i) => (
              <button
                key={p.id} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  i === index ? 'border-gold' : 'border-transparent opacity-60 hover:opacity-100',
                )}
              >
                <img src={p.thumb ?? p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the customer photographed before anyone visited — the closest thing the office has to
 * being on site. An even grid, because a mosaic leaves a hole whenever the count does not suit
 * it; a single photo gets the full width. Choosing any opens them full size.
 *
 * @param {{ photos: { id: string, url: string, thumb?: string, caption?: string }[], leadName: string }} props
 */
export function LeadPhotoGallery({ photos, leadName }) {
  const [openAt, setOpenAt] = useState(null);
  if (!photos?.length) return null;
  const many = photos.length > 1;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-gold/15 text-gold">
          <Images className="h-4 w-4" />
        </span>
        <CardTitle className="text-base">Photos from the customer</CardTitle>
        <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums leading-5 text-muted-foreground">
          {photos.length}
        </span>
      </CardHeader>
      <CardContent>
        <ul className={cn('grid gap-2', many ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1')}>
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpenAt(i)}
                aria-label={`Open photo ${i + 1} of ${photos.length}`}
                className="group relative block h-full w-full overflow-hidden rounded-xl border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={photo.thumb ?? photo.url}
                  alt={photo.caption ?? `Photo ${i + 1} sent by ${leadName}`}
                  loading="lazy"
                  className={cn(
                    'w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none',
                    many ? 'aspect-[4/3]' : 'max-h-[26rem]',
                  )}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center bg-ink/0 text-ink-foreground opacity-0 transition-[background-color,opacity] duration-300 group-hover:bg-ink/35 group-hover:opacity-100 motion-reduce:transition-none"
                >
                  <Expand className="h-5 w-5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
      {openAt != null ? (
        <Lightbox photos={photos} at={openAt} leadName={leadName} onClose={() => setOpenAt(null)} />
      ) : null}
    </Card>
  );
}
