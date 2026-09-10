import { PromiseList } from '@/components/site/PromiseList';
import { formatNpr } from '@/helpers/format';
import { formatDayKey } from './bookingDays';

/** One line of the summary. Always drawn, so the shape does not jump per step. */
function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * What has been chosen so far, held beside the flow the whole way down.
 *
 * Every row exists from the first step and fills in as the visitor answers, so
 * the panel never grows under the pointer — and an em dash reads as "not yet",
 * which is the honest state of a booking halfway through.
 */
export function BookingSummary({ service, qty, estimate, date, slot, slots }) {
  const chosenSlot = slots.find((s) => s.key === slot);

  const estimateValue = estimate
    ? `${formatNpr(estimate.min, { compact: true })} – ${formatNpr(estimate.max, { compact: true, symbol: false })}`
    : (service && !service.priceFrom ? 'After inspection' : '—');

  return (
    <aside className="lg:sticky lg:top-40">
      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">Your booking</p>

        <dl className="divide-y text-sm">
          <Row label="Service" value={service?.name ?? 'Not chosen yet'} />
          {service?.priceFrom ? <Row label={`Size (${service.priceUnit ?? 'qty'})`} value={qty || '—'} /> : null}
          <Row label="Estimate" value={estimateValue} />
          <Row label="Date" value={date ? formatDayKey(date) : '—'} />
          <Row label="Window" value={chosenSlot ? `${chosenSlot.label} · ${chosenSlot.window}` : '—'} />
        </dl>

        <div className="border-t bg-muted/30 px-5 py-4">
          <PromiseList variant="stack" className="text-xs" />
        </div>
      </div>
    </aside>
  );
}
