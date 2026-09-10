import { Eyebrow } from '@/components/site/Eyebrow';
import { imageUrl } from '@/helpers/format';

/**
 * Site photographs, at a fixed 4:3 so a mixed set of phone snaps still reads
 * as one gallery. A caption is the editor's, and describes the picture — the
 * alt text falls back to the project title so the image is never unlabelled.
 */
export function ProjectGallery({ images, media, title }) {
  if (!images?.length) return null;

  return (
    <section className="border-t py-8">
      <Eyebrow>On site</Eyebrow>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {images.map((img) => (
          <figure key={img.id} className="overflow-hidden rounded-xl border">
            <img
              src={imageUrl(media?.[img.mediaId], 800) ?? ''}
              alt={img.caption ?? title}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            {img.caption ? (
              <figcaption className="px-3 py-2 text-xs text-muted-foreground">{img.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
