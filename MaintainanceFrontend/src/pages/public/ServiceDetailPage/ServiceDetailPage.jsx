import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicServiceQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { ErrorState } from '@/components/common/ErrorState';
import { Eyebrow } from '@/components/site/Eyebrow';
import { FaqList } from '@/components/site/FaqList';
import { SectionShell } from '@/components/site/SectionShell';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { serviceJsonLd } from './serviceSeo';
import { InspectionPanel } from './sections/InspectionPanel';
import { RelatedProjects } from './sections/RelatedProjects';
import { ServiceBody } from './sections/ServiceBody';
import { ServiceMasthead } from './sections/ServiceMasthead';

/**
 * The per-service page the original site never had — the reason it lost every
 * long-tail search like "waterproofing cost Kathmandu".
 *
 * This file fetches, handles the three states, and says what order the bands
 * come in. Each band is its own file under `./sections/`, and the structured
 * data that makes the page findable is in `serviceSeo.js`.
 */
export default function ServiceDetailPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { name: company } = useSiteSettings();
  const { data, isLoading, error, refetch } = useGetPublicServiceQuery({ slug, locale });
  const service = data?.service;

  useSeo({
    title: service?.metaTitle ?? service?.name,
    description: service?.metaDescription ?? service?.excerpt,
    jsonLd: serviceJsonLd(service, company),
  });

  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading || !service) {
    return (
      <div className="container space-y-4 py-14">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <PageTransition>
      <ServiceMasthead service={service} media={data.media} slug={slug} />

      <SectionShell>
        <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
          <article>
            <ServiceBody body={service.body} />

            {data.faqs?.length ? (
              <section className="mt-14">
                <Eyebrow>Before you call</Eyebrow>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">Common questions</h2>
                <FaqList faqs={data.faqs} className="mt-7" />
              </section>
            ) : null}

            <RelatedProjects projects={data.related} media={data.media} slug={slug} />
          </article>

          <InspectionPanel service={service} slug={slug} />
        </div>
      </SectionShell>
    </PageTransition>
  );
}
