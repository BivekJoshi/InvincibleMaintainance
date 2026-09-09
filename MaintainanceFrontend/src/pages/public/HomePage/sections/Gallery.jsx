import { Card } from '@/components/ui/card';
import { Media, SectionHeading, SectionShell } from '@/components/site/siteBlocks';
import { cn } from '@/helpers/utils';

/**
 * The field gallery, as a mosaic rather than a uniform strip: the first tile is
 * twice the size, so the block reads as a wall of work instead of a grid of
 * thumbnails. Each picture wipes open as it arrives.
 */
export function Gallery({ section, media }) {
  const images = (Array.isArray(section.data) ? section.data : []).slice(0, 7);
  if (!images.length) return null;
  return (
    <SectionShell tone="muted">
      <SectionHeading eyebrow="On site" title="From the field" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((g, i) => (
          <figure key={g.id ?? i} className={cn('group relative', i === 0 && 'col-span-2 row-span-2')}>
            <Card className="h-full overflow-hidden">
              <Media
                media={media?.[g.imageId ?? g.mediaId]}
                alt={g.caption ?? ''}
                ratio={1}
                width={i === 0 ? 1200 : 800}
                icon="hard-hat"
                reveal
                zoom
                scrim={g.caption ? 'ink' : 'none'}
              >
                {g.caption ? (
                  <figcaption className="absolute inset-x-0 bottom-0 p-3 text-[12px] font-medium leading-snug text-ink-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {g.caption}
                  </figcaption>
                ) : null}
              </Media>
            </Card>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}
