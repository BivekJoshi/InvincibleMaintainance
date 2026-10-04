import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { cn } from '@/helpers/utils';

/** Five stars, filled to the rating; named for a screen reader in the screen's language (English in the back office). */
export function Stars({ rating = 5, className }) {
  const t = useT(SITE);
  return (
    <div role="img" className={cn('flex gap-0.5', className)} aria-label={t('stars', { rating })}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn('h-3.5 w-3.5', i < rating ? 'fill-gold' : 'fill-muted-foreground/25')} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L10 14.8 4.8 17.5l1-5.8L1.5 7.6l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}
