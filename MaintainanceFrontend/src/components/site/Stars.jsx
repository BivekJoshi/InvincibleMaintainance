import { cn } from '@/helpers/utils';

/** Five stars, filled to the rating. */
export function Stars({ rating = 5, className }) {
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn('h-3.5 w-3.5', i < rating ? 'fill-gold' : 'fill-muted-foreground/25')} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L10 14.8 4.8 17.5l1-5.8L1.5 7.6l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}
