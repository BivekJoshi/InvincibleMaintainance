import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatNpr, formatSignedNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

function Row({ label, value, strong, testId, muted }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', strong && 'border-t pt-3 text-base font-semibold', muted && 'text-muted-foreground')}>
      <span className={strong || muted ? undefined : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums" data-testid={testId}>{value}</span>
    </div>
  );
}

/**
 * The right rail's Totals: the server's figures — the live preview while the BOQ has edits (dimmed while a newer
 * answer is on its way), the saved quotation's otherwise. The browser adds up nothing: not the subtotal, not
 * VAT, not a section. Section subtotals list under the total, and optional rows as their own line.
 *
 * @param {{ totals: object, live: boolean, stale: boolean, skipped?: number, error?: object|null, dirty: boolean, validUntil?: string }} props
 */
export function TotalsCard({ totals, live, stale, skipped = 0, error, dirty, validUntil }) {
  const sections = (totals?.sections ?? []).filter((s) => s.index != null);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Totals</CardTitle>
        {dirty && stale ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Working out the totals" /> : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm" aria-busy={dirty && stale ? true : undefined}>
        <div className={cn('space-y-3 transition-opacity', dirty && stale && 'opacity-60')} data-testid="totals" data-source={live ? 'preview' : 'saved'}>
          {/* A variation's figures may be below zero (Phase L7: omissions) — "− Rs. …", never "Rs. -…". */}
          <Row label="Subtotal" value={formatSignedNpr(totals?.subtotal)} testId="quotation-subtotal" />
          <Row label="Discount" value={`− ${formatNpr(totals?.discount)}`} testId="quotation-discount" />
          <Row label={`VAT ${totals?.vatApplied ? `(${totals?.vatRate}%)` : '(not applied)'}`} value={formatSignedNpr(totals?.vatAmount)} />
          <Row label="Total" value={formatSignedNpr(totals?.total)} strong testId="quotation-total" />
          {totals?.optionalTotal > 0 ? (
            <Row label="Optional rows (not in the total)" value={`(${formatNpr(totals.optionalTotal)})`} muted testId="quotation-optional" />
          ) : null}
          {sections.length ? (
            <ul className="space-y-1 border-t pt-3 text-xs" aria-label="Section subtotals">
              {sections.map((s) => (
                <li key={s.index} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate"><span className="font-mono font-semibold">{s.number}</span> {s.title}</span>
                  <span className="shrink-0 tabular-nums">{formatSignedNpr(s.subtotal)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="flex gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error?.data?.error?.message ?? 'The totals could not be worked out.'}
          </p>
        ) : null}
        {dirty ? (
          <p className="text-xs text-muted-foreground">
            {live ? 'Worked out by the server from your edits' : 'Working out your edits'}
            {skipped ? ` — ${skipped} unfinished ${skipped === 1 ? 'row is' : 'rows are'} left out until ${skipped === 1 ? 'it has' : 'they have'} a quantity and a rate` : ''}
            . Save to keep them.
          </p>
        ) : null}
        {validUntil ? <p className="text-xs text-muted-foreground">Valid until {formatDate(validUntil)}</p> : null}
      </CardContent>
    </Card>
  );
}
