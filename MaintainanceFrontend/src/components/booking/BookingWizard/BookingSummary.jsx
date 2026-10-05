import { PromiseList } from '@/components/site/PromiseList';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';
import { formatDayKey, slotName } from './bookingDays';

/** One line of the summary. Always drawn, so the shape does not jump per step. */
function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] break-words text-right font-medium">{value}</dd>
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
  const t = useT(SITE);
  const { locale } = t;
  const chosenSlot = slots.find((s) => s.key === slot);

  const estimateValue = estimate
    ? `${formatNpr(estimate.min, { compact: true, locale })} – ${formatNpr(estimate.max, { compact: true, symbol: false, locale })}`
    : (service && !service.priceFrom ? t('booking.summary.afterInspection') : '—');

  return (
    <aside className="lg:sticky lg:top-40">
      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">{t('booking.summary.title')}</p>

        <dl className="divide-y text-sm">
          <Row label={t('booking.summary.service')} value={service?.name ?? t('booking.summary.notChosen')} />
          {service?.priceFrom ? (
            <Row
              label={t('booking.summary.size', { unit: service.priceUnit ?? t('booking.size.quantity') })}
              value={qty || '—'}
            />
          ) : null}
          <Row label={t('booking.summary.estimate')} value={estimateValue} />
          <Row label={t('booking.summary.date')} value={date ? formatDayKey(date, { locale }) : '—'} />
          <Row label={t('booking.summary.window')} value={chosenSlot ? `${slotName(t, chosenSlot)} · ${chosenSlot.window}` : '—'} />
        </dl>

        <div className="border-t bg-muted/30 px-5 py-4">
          <PromiseList variant="stack" className="text-xs" />
        </div>
      </div>
    </aside>
  );
}
