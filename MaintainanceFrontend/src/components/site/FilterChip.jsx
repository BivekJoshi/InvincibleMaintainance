import { X } from 'lucide-react';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { cn } from '@/helpers/utils';

/**
 * An applied filter, and the way out of it. Always removable — a chip that
 * cannot be cleared is a label, and a label does not belong in a filter row.
 */
export function FilterChip({ children, onClear, icon: Icon, className }) {
  const t = useT(SITE);
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        'flex min-w-0 max-w-full items-center gap-1.5 break-words rounded-full border bg-card px-3 py-1.5 text-left text-xs font-medium transition-colors hover:border-primary/40',
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
      <X className="h-3 w-3 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t('clearFilter')}</span>
    </button>
  );
}
