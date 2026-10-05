import { AnimatePresence, motion } from '@/three/motion/motionKit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';

/**
 * Step two: how big is it.
 *
 * Only for services with a published rate. A service priced on inspection gets
 * the honest version of this step instead of a number field it cannot use —
 * asking for a quantity that changes nothing is how a form loses trust.
 *
 * The quantity is typed as it is, Latin digits and all, and sent as a number — only the words around it change with
 * the language. The API's estimate disclaimer is one fixed sentence, so the site says it in the visitor's language.
 */
export function StepSize({ service, qty, onQty, estimate, estimating }) {
  const t = useT(SITE);
  const { locale } = t;
  if (!service) return null;

  if (!service.priceFrom) {
    return (
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('booking.size.onInspection')}</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {t('booking.size.onInspectionBody', { service: service.name })}
        </p>
      </div>
    );
  }

  const rate = [
    formatNpr(service.priceFrom, { compact: true, locale }),
    service.priceTo ? formatNpr(service.priceTo, { compact: true, symbol: false, locale }) : null,
  ].filter(Boolean).join(' – ');

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{t('booking.size.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('booking.size.description')}</p>

      <div className="mt-5 max-w-xs space-y-1.5">
        <Label htmlFor="booking-qty">
          {t('booking.size.approx', { unit: service.priceUnit ?? t('booking.size.quantity') })}
        </Label>
        <Input
          id="booking-qty" type="number" inputMode="decimal" min="1" step="any"
          value={qty} onChange={(e) => onQty(e.target.value)} placeholder={t('booking.size.placeholder')}
        />
        <p className="text-xs text-muted-foreground">
          {service.priceUnit
            ? t('booking.size.ratePer', { rate, unit: service.priceUnit })
            : t('booking.size.rate', { rate })}
        </p>
      </div>

      <AnimatePresence>
        {estimate && !estimating ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-6 max-w-md rounded-xl border border-gold/40 bg-gold/[0.07] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('booking.size.range', { qty: estimate.qty, unit: estimate.unit })}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">
              {formatNpr(estimate.min, { compact: true, locale })}
              <span className="text-muted-foreground"> – </span>
              {formatNpr(estimate.max, { compact: true, symbol: false, locale })}
            </p>
            <p className="mt-2 border-t border-gold/25 pt-2 text-xs text-muted-foreground">{t('estimate.disclaimer')}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
