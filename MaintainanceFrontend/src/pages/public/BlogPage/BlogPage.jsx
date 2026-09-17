import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicPostsQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHero } from '@/components/site/PageHero';
import { SectionShell } from '@/components/site/SectionShell';
import { PageTransition } from '@/three/motion/motionKit';
import { PostCategoryFilter } from './sections/PostCategoryFilter';
import { PostGrid } from './sections/PostGrid';

/**
 * `/blog` — advice a homeowner searches for, newest first. The category is a server
 * query held in the URL, so a filtered list is a link that can be shared. Only posts
 * whose publish time has passed are listed (the API decides).
 */
export default function BlogPage() {
  const locale = useSelector(selectLocale);
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? '';
  const { data, isLoading, error, refetch } = useGetPublicPostsQuery({ locale, ...(category ? { category } : {}) });

  useSeo({
    title: 'Advice for homeowners',
    description: 'Practical notes on damp, waterproofing, repairs and renovation from our engineers in Kathmandu.',
  });

  return (
    <PageTransition>
      <PageHero
        eyebrow="Blog"
        title="Advice for homeowners"
        description="What our engineers see on site, written up so you can tell what you are dealing with before anyone visits."
      />
      <SectionShell>
        {error ? <ErrorState error={error} onRetry={refetch} /> : (
          <>
            <PostCategoryFilter
              categories={data?.categories ?? []}
              value={category}
              onChange={(slug) => setSearchParams(slug ? { category: slug } : {})}
            />
            <PostGrid posts={data?.items ?? []} media={data?.media} isLoading={isLoading} filtered={Boolean(category)} />
          </>
        )}
      </SectionShell>
    </PageTransition>
  );
}
