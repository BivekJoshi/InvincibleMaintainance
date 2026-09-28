import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';

/**
 * The server's totals of a set of payments (Phase I) — the payments list's `meta.totals` under its filters (every page,
 * not the one on screen) and the collections report's own: the total, how many, and each method's amount. A voided
 * payment is never in them. Nothing here adds up.
 *
 * @param {{ totals?: { total: number, count: number, byMethod?: Record<string, number> } | null, label?: string }} props
 */
export function PaymentTotals({ totals, label = 'Totals of these payments' }) {
  if (!totals) return null;
  const methods = PAYMENT_METHODS.filter((m) => totals.byMethod?.[m]);
  return (
    <footer className="mt-3 rounded-xl border bg-card p-4" data-testid="payment-totals" aria-label={label}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {totals.count} payment{totals.count === 1 ? '' : 's'} received — voided ones not counted
        </p>
        <p className="text-lg font-semibold tabular-nums" data-testid="payments-total">{formatNpr(totals.total)}</p>
      </div>
      {methods.length ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {methods.map((m) => (
            <div key={m} className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{PAYMENT_METHOD_LABELS[m]}</dt>
              <dd className="font-medium tabular-nums">{formatNpr(totals.byMethod[m])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}
