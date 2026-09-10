import { AnimatePresence, motion } from '@/three/motion/motionKit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatNpr } from '@/helpers/format';

/**
 * Step two: how big is it.
 *
 * Only for services with a published rate. A service priced on inspection gets
 * the honest version of this step instead of a number field it cannot use —
 * asking for a quantity that changes nothing is how a form loses trust.
 */
export function StepSize({ service, qty, onQty, estimate, estimating }) {
  if (!service) return null;

  if (!service.priceFrom) {
    return (
      <div>
        <h2 className="text-xl font-bold tracking-tight">This one is priced on inspection</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {service.name} varies too much to publish a rate. The free visit produces a written,
          itemised quotation before anything starts — you are not committing to a figure now.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">How big is the job?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A rough number is fine — it only sets the indicative range. The engineer measures on site.
      </p>

      <div className="mt-5 max-w-xs space-y-1.5">
        <Label htmlFor="booking-qty">Approximate {service.priceUnit ?? 'quantity'}</Label>
        <Input
          id="booking-qty" type="number" inputMode="decimal" min="1" step="any"
          value={qty} onChange={(e) => onQty(e.target.value)} placeholder="e.g. 540"
        />
        <p className="text-xs text-muted-foreground">
          Published rate: {formatNpr(service.priceFrom, { compact: true })}
          {service.priceTo ? ` – ${formatNpr(service.priceTo, { compact: true, symbol: false })}` : ''}
          {service.priceUnit ? ` per ${service.priceUnit}` : ''}
        </p>
      </div>

      <AnimatePresence>
        {estimate && !estimating ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-6 max-w-md rounded-xl border border-gold/40 bg-gold/[0.07] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Indicative range for {estimate.qty} {estimate.unit}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">
              {formatNpr(estimate.min, { compact: true })}
              <span className="text-muted-foreground"> – </span>
              {formatNpr(estimate.max, { compact: true, symbol: false })}
            </p>
            <p className="mt-2 border-t border-gold/25 pt-2 text-xs text-muted-foreground">{estimate.disclaimer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
