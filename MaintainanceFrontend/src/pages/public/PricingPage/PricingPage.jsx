import { useState } from 'react';
import { useGetPublicPricingQuery } from '@/api/publicApi';
import { SITE } from '@/config/i18n/site';
import { useSeo } from '@/hooks/useSeo';
import { useApiErrorText, useT } from '@/hooks/useT';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { EstimatorPanel } from './sections/EstimatorPanel';
import { PackagePlans } from './sections/PackagePlans';
import { RateCard } from './sections/RateCard';

/**
 * Rates, published before anyone calls.
 *
 * Two columns and one piece of state between them: the estimate the visitor
 * has just produced. It lives here rather than inside the estimator because
 * the lead form that consumes it is a sibling, not a child.
 */
export default function PricingPage() {
  const t = useT(SITE);
  const errorText = useApiErrorText(SITE);
  const { data, isLoading, error, refetch } = useGetPublicPricingQuery(t.locale);
  const [estimate, setEstimate] = useState(null);

  useSeo({ title: t('pricing.title'), description: t('pricing.seoDescription') });

  if (error) {
    return (
      <ErrorState
        error={error} onRetry={refetch} className="min-h-[60dvh]"
        message={errorText(error)} retryLabel={t('common.tryAgain')}
      />
    );
  }
  if (isLoading) return <div className="container py-14"><Skeleton className="h-96 w-full rounded-lg" /></div>;

  return (
    <PageTransition>
      <PageHero eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} description={t('pricing.description')} />

      <SectionShell>
        <div className="grid gap-10 lg:grid-cols-[380px_1fr] lg:items-start">
          <EstimatorPanel services={data.services} estimate={estimate} onEstimate={setEstimate} />

          <div className="space-y-10">
            <PackagePlans plans={data.plans} />
            <RateCard items={data.rateCard} />
          </div>
        </div>
      </SectionShell>
    </PageTransition>
  );
}
