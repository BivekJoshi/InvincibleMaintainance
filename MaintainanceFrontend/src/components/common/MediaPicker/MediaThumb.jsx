import { useEffect, useMemo, useState } from 'react';
import { decode } from 'blurhash';
import { FileText, ImageIcon } from 'lucide-react';
import { imageUrl } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** Decoded placeholders, by hash. Decoding is cheap but not free, and a grid repeats it on every page. */
const placeholders = new Map();

/**
 * A blurhash as a 32×32 data URL, or null. Browsers without a 2D canvas (jsdom, for
 * one) get no placeholder rather than an error.
 */
function blurhashUrl(hash) {
  if (!hash) return null;
  if (placeholders.has(hash)) return placeholders.get(hash);
  let url = null;
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (ctx) {
      canvas.width = size;
      canvas.height = size;
      const image = ctx.createImageData(size, size);
      image.data.set(decode(hash, size, size));
      ctx.putImageData(image, 0, 0);
      url = canvas.toDataURL();
    }
  } catch {
    url = null;
  }
  placeholders.set(hash, url);
  return url;
}

/**
 * A media library tile's picture: the stored blurhash first, then the 400px variant
 * (`media.thumb`, which the API resolves) fading in over it. A document gets an icon.
 *
 * @param {object} props
 * @param {object} [props.media] a media row from `/admin/media`
 */
export function MediaThumb({ media, alt, className }) {
  const src = media?.thumb ?? imageUrl(media, 400);
  const isImage = !media?.mime || media.mime.startsWith('image/');
  const placeholder = useMemo(() => blurhashUrl(media?.blurhash), [media?.blurhash]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [src]);

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-muted', className)}
      style={placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' } : undefined}
    >
      {src && isImage ? (
        <img
          src={src}
          alt={alt ?? media?.alt ?? ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          {media && !isImage ? <FileText className="h-5 w-5" aria-hidden /> : <ImageIcon className="h-5 w-5" aria-hidden />}
        </div>
      )}
    </div>
  );
}
