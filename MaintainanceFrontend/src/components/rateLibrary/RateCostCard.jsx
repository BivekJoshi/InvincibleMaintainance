import { useWatch } from 'react-hook-form';
import { skipToken } from '@reduxjs/toolkit/query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDeriveRateCostQuery } from '@/api/rateLibraryApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { StateBadge } from '@/components/common/StateBadge';
import { formatNpr } from '@/helpers/format';
import { deriveRequest, formRateToPaisa } from '@/helpers/recipe';
import { cn } from '@/helpers/utils';

function Row({ label, value, strong, tone, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className={cn('text-sm', strong ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
        {sub ? <span className="block text-xs font-normal text-muted-foreground">{sub}</span> : null}
      </dt>
      <dd className={cn('whitespace-nowrap text-right tabular-nums', strong && 'font-semibold', tone)}>{value}</dd>
    </div>
  );
}

const marginText = (m) => (m ? `${formatNpr(m.amount)}${m.pct != null ? ` · ${m.pct}%` : ''}` : '—');
const marginTone = (m) => (m && m.amount < 0 ? 'text-destructive' : undefined);

/**
 * The rate form's live **Cost vs rate** card (a `preview` field, shown only with `costs:read`). It sends the
 * recipe as typed to `POST /admin/rate-card/derive` — debounced, and only once every line is complete — and
 * shows what the server works out at today's prices: material, labour, equipment, other, overhead and the
 * unit cost, the derived rate, and the margin at the current rate. The client never prices a line itself.
 *
 * @param {{ field: { label?: string }, id: string }} props
 */
export function RateCostCard({ field, id }) {
  const values = useWatch();
  const { ready, unfinished, body } = deriveRequest(values);
  const settledKey = useDebouncedValue(ready ? JSON.stringify(body) : null, 400);
  const settled = ready && settledKey === JSON.stringify(body);
  const { data, error, isFetching } = useDeriveRateCostQuery(settledKey ? JSON.parse(settledKey) : skipToken);

  const unit = values?.unit || 'unit';
  const derived = values?.rateMode === 'DERIVED';
  const currentRate = formRateToPaisa(values?.rate);
  const b = data?.costBreakdown;
  const missingPrices = (data?.lines ?? []).filter((l) => l.lineCost == null).length;
  const showFigures = ready && data && !error;

  let content;
  if (!ready) {
    content = (
      <p className="text-sm text-muted-foreground">
        {unfinished
          ? `Finish the recipe to see its cost: ${unfinished} ${unfinished === 1 ? 'line needs' : 'lines need'} what it is and a quantity (and a cost, for equipment and other).`
          : `Add a recipe line to see what one ${unit} costs at today’s prices.`}
      </p>
    );
  } else if (error && settled) {
    content = (
      <p role="alert" className="text-sm text-destructive">
        {error?.data?.error?.message ?? 'The cost could not be worked out.'}
      </p>
    );
  } else if (!showFigures) {
    content = <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out the cost…</p>;
  } else {
    // Both margins are the server's (money.js#margin) — the client subtracts no money.
    const atCurrent = data.margin;
    const atDerived = data.derivedMargin;
    content = (
      <div className={cn('transition-opacity', (isFetching || !settled) && 'opacity-60')} aria-busy={isFetching || !settled}>
        {missingPrices ? (
          <p className="mb-2 flex gap-2 rounded-md surface-warning p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {missingPrices === 1 ? 'One line has' : `${missingPrices} lines have`} no price yet — set the material’s purchase rate or the
            trade’s day wage. There is no derived rate until every line is priced.
          </p>
        ) : null}
        <dl className="divide-y">
          <div>
            <Row label="Material" value={formatNpr(b.material)} />
            <Row label="Labour" value={formatNpr(b.labour)} />
            <Row label="Equipment" value={formatNpr(b.equipment)} />
            <Row label="Other" value={formatNpr(b.other)} />
            <Row label="Overhead" value={formatNpr(b.overhead)} />
          </div>
          <Row label={`Unit cost / ${unit}`} value={formatNpr(b.unitCost)} strong />
          <div>
            <Row
              label="Derived rate"
              sub="Cost plus profit, rounded up"
              value={data.derivedRate == null ? '—' : formatNpr(data.derivedRate)}
              strong={derived}
            />
            <Row label={derived ? 'Rate now' : 'Your rate'} value={currentRate == null ? '—' : formatNpr(currentRate)} strong={!derived} />
            <Row label={derived ? 'Margin at the rate now' : 'Margin'} value={marginText(atCurrent)} tone={marginTone(atCurrent)} />
            {derived ? <Row label="Margin at the derived rate" value={marginText(atDerived)} tone={marginTone(atDerived)} /> : null}
          </div>
        </dl>
        {derived && data.derivedRate != null && currentRate != null && data.derivedRate !== currentRate ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <StateBadge tone="warning">Differs</StateBadge>
            <span>Saving sets the rate to {formatNpr(data.derivedRate)} a {unit}.</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-semibold">{field.label ?? 'Cost vs rate'}</h3>
        <span className="text-xs text-muted-foreground">Per {unit} at today’s prices · managers and admins only</span>
      </div>
      {content}
    </div>
  );
}
