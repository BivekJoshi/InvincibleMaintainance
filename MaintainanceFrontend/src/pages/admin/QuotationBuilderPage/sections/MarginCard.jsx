import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * The right rail's Margin — **only for `costs:read`** (MANAGER, ADMIN; L-D4). The page renders it behind the
 * capability; the API strips the figures for everyone else anyway. Cost and margin are the server's: the cost of
 * the rows' frozen recipes, and the margin on the taxable amount. A row with no known cost makes the margin
 * unknown — never a guess that counts it as zero.
 *
 * @param {{ cost: { costTotal: number, costComplete: boolean, margin: { amount: number, pct: number|null }|null }|null, stale?: boolean }} props
 */
export function MarginCard({ cost, stale }) {
  const margin = cost?.margin;
  return (
    <Card data-testid="margin-card">
      <CardHeader className="pb-3"><CardTitle className="text-base">Margin</CardTitle></CardHeader>
      <CardContent className={cn('space-y-2 text-sm transition-opacity', stale && 'opacity-60')}>
        {cost ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Cost of the rows</span>
              <span className="tabular-nums" data-testid="cost-total">{formatNpr(cost.costTotal)}</span>
            </div>
            <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
              <span>Margin</span>
              <span className={cn('tabular-nums', margin?.amount < 0 && 'text-destructive')} data-testid="margin">
                {margin ? `${formatNpr(margin.amount)}${margin.pct != null ? ` · ${margin.pct}%` : ''}` : 'Unknown'}
              </span>
            </div>
            {!cost.costComplete ? (
              <p className="flex gap-2 rounded-md surface-warning p-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Some rows have no known cost (typed, or priced before recipes), so the margin is not worked out.
                Price them from the rate library to see it.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">On the amount before VAT, after the discount. Optional rows are left out.</p>
          </>
        ) : (
          <p className="text-muted-foreground">No cost yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
