import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetPublicPricingQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
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
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicPricingQuery(locale);
  const [estimate, setEstimate] = useState(null);

  useSeo({
    title: 'Our rates, published before you call',
    description: 'Published rates for every service, an instant estimator, and a free inspection before the exact figure is confirmed.',
  });

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading) return <div className="container py-14"><Skeleton className="h-96 w-full rounded-lg" /></div>;

  return (
    <PageTransition>
      <PageHero
        eyebrow="Transparent pricing"
        title="Our rates, published before you call"
        description="The estimator gives you a range instantly. The exact figure is confirmed after a free inspection — never after the work."
      />

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
