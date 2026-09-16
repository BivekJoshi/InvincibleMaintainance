import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/helpers/utils';
import { MediaThumb } from './MediaThumb';

const GRID = 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6';

/**
 * The media library's grid — shared by `MediaPicker` (choosing) and the library screen
 * (managing), so a tile, its "No alt text" warning, the empty state and the pager look
 * the same in both. A tile is a button; what pressing it means is the caller's.
 *
 * @param {object} props
 * @param {object[]} props.items
 * @param {boolean} props.isLoading
 * @param {boolean} [props.isFetching]
 * @param {unknown} [props.error]
 * @param {() => void} [props.refetch]
 * @param {(media: object) => void} props.onSelect
 * @param {(media: object) => void} [props.onDoubleSelect]
 * @param {(media: object) => boolean} [props.isSelected]  shows a check and sets aria-pressed
 * @param {(media: object) => import('react').ReactNode} [props.badge]  top-right corner, e.g. the check
 * @param {string} props.emptyTitle
 * @param {string} [props.emptyDescription]
 * @param {string} [props.className]
 */
export function MediaGrid({
  items, isLoading, isFetching, error, refetch, onSelect, onDoubleSelect, isSelected, badge,
  emptyTitle, emptyDescription, className,
}) {
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className={cn(GRID, className)} aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
      </div>
    );
  }
  if (!items.length) return <EmptyState icon={ImageOff} title={emptyTitle} description={emptyDescription} />;

  return (
    <ul className={cn(GRID, isFetching && 'opacity-60', className)}>
      {items.map((media) => {
        const chosen = isSelected?.(media) ?? false;
        return (
          <li key={media.id}>
            <button
              type="button"
              onClick={() => onSelect(media)}
              onDoubleClick={onDoubleSelect ? () => onDoubleSelect(media) : undefined}
              aria-pressed={isSelected ? chosen : undefined}
              aria-label={media.alt || 'Image without alt text'}
              title={media.alt || undefined}
              className={cn(
                'relative block aspect-square w-full overflow-hidden rounded-md border-2 transition-colors',
                chosen ? 'border-primary' : 'border-transparent hover:border-border',
              )}
            >
              <MediaThumb media={media} alt="" />
              {badge?.(media)}
              {!media.alt ? (
                <span className="surface-warning absolute inset-x-1 bottom-1 truncate rounded px-1 text-[10px] font-medium">No alt text</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Previous / Next under the grid; nothing when there is one page.
 *
 * @param {{ page: number, pages: number, onPageChange: (page: number) => void }} props
 */
export function MediaPager({ page, pages, onPageChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden /> Previous
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
