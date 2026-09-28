import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/helpers/utils';

/**
 * A report's headline figures (Phase I) — each a label and the server's value, already worded (`formatNpr`, a count,
 * a rate the API sent). A tile with `onClick` is a button (the aging buckets drill down), and `active` marks the one
 * chosen. `bar` (0–1) draws a thin proportion under the value — a picture of the server's figures, never a new one.
 *
 * @param {{ items: { key?: string, label: string, value: import('react').ReactNode, hint?: string, tone?: 'destructive'|'success',
 *   onClick?: () => void, active?: boolean, bar?: number }[], isLoading?: boolean, label?: string, className?: string }} props
 */
export function ReportFigures({ items, isLoading, label, className }) {
  if (isLoading) {
    return (
      <div className={cn('mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }
  return (
    <ul aria-label={label} className={cn('mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.filter(Boolean).map((item) => {
        const body = (
          <>
            <span className="block text-xs text-muted-foreground">{item.label}</span>
            <span className={cn(
              'mt-1 block text-lg font-semibold tabular-nums',
              item.tone === 'destructive' && 'text-destructive',
              item.tone === 'success' && 'text-success',
            )}
            >
              {item.value}
            </span>
            {item.hint ? <span className="block text-[11px] text-muted-foreground">{item.hint}</span> : null}
            {item.bar != null ? (
              <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${Math.round(Math.min(1, Math.max(0, item.bar)) * 100)}%` }} />
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.key ?? item.label}>
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                aria-pressed={Boolean(item.active)}
                className={cn(
                  'w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  item.active && 'border-primary bg-primary/[0.05]',
                )}
              >
                {body}
              </button>
            ) : <div className="rounded-xl border bg-card p-4">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
