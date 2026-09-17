import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicPageQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero } from '@/components/site/PageHero';
import { ProseBody } from '@/components/site/ProseBody';
import { SectionShell } from '@/components/site/SectionShell';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * `/:slug` — a page an editor wrote (About, warranty terms…). The route sits after every
 * other public route, so it only sees addresses nothing else claimed; an address with no
 * live page behind it is the API's 404, shown as the not-found page.
 */
export default function GenericPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { data, isLoading, error, refetch } = useGetPublicPageQuery({ slug, locale });
  const page = data?.page;

  // `||`, not `??`: an SEO field left empty in the admin is saved as ''.
  useSeo({ title: page?.metaTitle || page?.title, description: page?.metaDescription || undefined });

  if (error?.status === 404) return <NotFoundPage className="min-h-[60dvh]" />;
  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading || !page) {
    return (
      <div className="container space-y-4 py-14" aria-hidden>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <PageTransition>
      <PageHero title={page.title} />
      <SectionShell>
        <ProseBody body={page.body} className="text-[15px]" />
      </SectionShell>
    </PageTransition>
  );
}
