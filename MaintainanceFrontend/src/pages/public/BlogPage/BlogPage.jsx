import { useSearchParams } from 'react-router-dom';
import { useGetPublicPostsQuery } from '@/api/publicApi';
import { SITE } from '@/config/i18n/site';
import { useSeo } from '@/hooks/useSeo';
import { useApiErrorText, useT } from '@/hooks/useT';
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
  const t = useT(SITE);
  const errorText = useApiErrorText(SITE);
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? '';
  const { data, isLoading, error, refetch } = useGetPublicPostsQuery({ locale: t.locale, ...(category ? { category } : {}) });

  useSeo({ title: t('blog.title'), description: t('blog.seoDescription') });

  return (
    <PageTransition>
      <PageHero eyebrow={t('nav.blog')} title={t('blog.title')} description={t('blog.description')} />
      <SectionShell>
        {error ? <ErrorState error={error} onRetry={refetch} message={errorText(error)} retryLabel={t('common.tryAgain')} /> : (
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
