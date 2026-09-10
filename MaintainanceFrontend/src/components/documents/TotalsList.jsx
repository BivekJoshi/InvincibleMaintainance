import { cn } from '@/helpers/utils';

/**
 * The money column under a line-item table.
 *
 * A definition list, because that is what it is: each label defines the figure
 * beside it. `emphasis` marks the line the customer is actually looking for —
 * the total, or what is still owed — and `tone` colours an overdue balance
 * without a component inventing its own red.
 */
export function TotalsList({ rows, className }) {
  return (
    <dl className={cn('ml-auto max-w-xs space-y-2 text-sm', className)}>
      {rows.filter(Boolean).map((row) => (
        <div
          key={row.label}
          className={cn(
            'flex items-center justify-between gap-4',
            row.emphasis && 'border-t pt-2 text-base font-bold',
            row.tone === 'success' && 'text-success',
            row.tone === 'destructive' && 'text-destructive',
          )}
        >
          <dt className={cn(!row.emphasis && !row.tone && 'text-muted-foreground')}>{row.label}</dt>
          <dd className="tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
