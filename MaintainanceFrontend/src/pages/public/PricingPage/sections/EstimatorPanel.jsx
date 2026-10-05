import { Estimator } from '@/components/public/Estimator';
import { LeadCaptureCard } from '@/components/public/LeadCaptureCard';
import { LeadForm } from '@/components/public/LeadForm';
import { Reveal } from '@/three/motion/motionKit';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/**
 * The estimator, and the form that appears once it has produced a number.
 *
 * The lead form is deliberately withheld until then: asking for a phone number
 * before the visitor has anything in return is the exact moment the old site
 * lost them. Once there is an estimate on screen there is something to send,
 * and the estimate travels with the enquiry to the free inspection.
 */
export function EstimatorPanel({ services, estimate, onEstimate }) {
  const t = useT(SITE);
  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      <Estimator services={services} onEstimate={onEstimate} />

      {estimate ? (
        <Reveal>
          <LeadCaptureCard
            title={t('pricing.quote.title')}
            description={t('pricing.quote.description')}
            className="border-gold/40"
          >
            <LeadForm
              services={services}
              defaultServiceId={estimate.serviceId}
              estimate={estimate}
              sourcePage="/pricing"
            />
          </LeadCaptureCard>
        </Reveal>
      ) : null}
    </div>
  );
}
