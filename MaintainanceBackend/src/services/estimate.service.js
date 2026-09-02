import { prisma } from '../lib/prisma.js';
import { badRequest } from '../utils/AppError.js';
import { formatNpr } from '../utils/money.js';

/**
 * Public cost estimator — the conversion feature the original site lacks.
 * Returns a min/max band, never a single number, so it cannot be mistaken for a quote.
 */
export async function estimate({ serviceId, pricingPlanId, qty }) {
  const source = serviceId
    ? await prisma.service.findFirst({ where: { id: serviceId, isActive: true, deletedAt: null } })
    : await prisma.pricingPlan.findFirst({ where: { id: pricingPlanId, isActive: true, deletedAt: null } });

  if (!source) throw badRequest('That service is not available for estimating');

  const min = source.priceFrom ?? source.priceMin;
  const max = source.priceTo ?? source.priceMax ?? min;
  if (min == null) {
    throw badRequest('This service is priced on inspection. Request a free visit and we will quote it.');
  }

  const unit = source.priceUnit ?? source.unit ?? 'unit';
  const low = Math.round(min * qty);
  const high = Math.round((max ?? min) * qty);

  return {
    serviceId: serviceId ?? null,
    pricingPlanId: pricingPlanId ?? null,
    name: source.name ?? source.title,
    qty,
    unit,
    rateMin: min,
    rateMax: max ?? min,
    min: low,
    max: high,
    display: { min: formatNpr(low), max: formatNpr(high), rate: `${formatNpr(min)} – ${formatNpr(max ?? min)} per ${unit}` },
    disclaimer:
      'This is an indicative range based on our published rates. Final pricing is confirmed after a free site inspection.',
  };
}
