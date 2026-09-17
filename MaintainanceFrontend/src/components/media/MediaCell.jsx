import { useGetMediaQuery } from '@/api/mediaApi';
import { MediaThumb } from '@/components/common/MediaPicker/MediaThumb';

/** A small thumbnail of one media id, for a list column (the gallery). */
export function MediaCell({ id, className = 'h-12 w-16' }) {
  const { data } = useGetMediaQuery(id, { skip: !id });
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-md border bg-muted`}>
      {id ? <MediaThumb media={data} /> : null}
    </div>
  );
}
