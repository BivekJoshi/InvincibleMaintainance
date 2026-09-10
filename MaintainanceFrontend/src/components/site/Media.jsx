import { AspectRatio } from '@/components/ui/aspect-ratio';
import { RevealImage } from '@/three/motion/motionKit';
import { imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { DataIcon } from './DataIcon';

/**
 * A reserved space for a picture.
 *
 * Every image on the public site goes through this. The point is the *space*:
 * the box is laid out from its ratio before anything loads, so a section looks
 * the same whether or not an editor has uploaded the picture yet, and uploading
 * one never reflows the page around it. With no media it draws a spec plate —
 * a tinted, hatched surface with registration ticks and the section's own icon
 * on a plate of its own — so an un-illustrated card reads as a specified
 * surface rather than as a hole.
 *
 * @param {object} props
 * @param {object|string} [props.media] resolved media row, or a URL
 * @param {number} [props.ratio] width / height — 16/10 by default
 * @param {number} [props.width] variant to request from the media row
 * @param {string} [props.icon] lucide name drawn when there is no picture
 * @param {boolean} [props.reveal] wipe the picture open as it scrolls in
 * @param {'none'|'soft'|'ink'} [props.scrim] gradient for text laid over it
 * @param {boolean} [props.fill] take the parent's height instead of a ratio,
 *   for a slot whose box the layout already decides — a column beside copy that
 *   has to end level with it, rather than at whatever height a ratio lands on
 */
export function Media({
  media, alt = '', ratio = 16 / 10, width = 800, icon = 'hammer', className, imgClassName,
  reveal = false, scrim = 'none', zoom = false, priority = false, fill = false, children,
}) {
  const src = imageUrl(media, width);

  const picture = src ? (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn(
        'h-full w-full object-cover',
        zoom && 'transition-transform duration-700 ease-out group-hover:scale-[1.05]',
        imgClassName,
      )}
    />
  ) : (
    <div className="spec-plate spec-ticks grid h-full w-full place-items-center">
      <span className="grid h-14 w-14 place-items-center rounded-full border border-border/60 bg-card/70 text-muted-foreground/50 shadow-hairline">
        <DataIcon name={icon} className="h-6 w-6" />
      </span>
    </div>
  );

  const body = (
    <>
      {reveal && src ? <RevealImage className="h-full w-full">{picture}</RevealImage> : picture}
      {scrim !== 'none' && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            scrim === 'ink'
              ? 'bg-gradient-to-t from-ink/85 via-ink/25 to-transparent'
              : 'bg-gradient-to-t from-background/70 to-transparent',
          )}
        />
      )}
      {children}
    </>
  );

  if (fill) {
    return <div className={cn('relative h-full w-full overflow-hidden bg-muted', className)}>{body}</div>;
  }

  return (
    <AspectRatio ratio={ratio} className={cn('relative overflow-hidden bg-muted', className)}>
      {body}
    </AspectRatio>
  );
}
