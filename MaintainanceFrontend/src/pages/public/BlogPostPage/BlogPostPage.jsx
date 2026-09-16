import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetPublicPostQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { useSeo } from '@/hooks/useSeo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { ErrorState } from '@/components/common/ErrorState';
import { SectionShell } from '@/components/site/SectionShell';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { imageUrl } from '@/helpers/format';
import NotFoundPage from '@/pages/NotFoundPage';
import { postJsonLd } from './postSeo';
import { PostArticle } from './sections/PostArticle';
import { PostCta } from './sections/PostCta';
import { PostHeader } from './sections/PostHeader';

/**
 * `/blog/:slug` — one article at reading width. A draft, a scheduled post or an unknown
 * slug is a 404 from the API, and renders the not-found page rather than an error.
 */
export default function BlogPostPage() {
  const { slug } = useParams();
  const locale = useSelector(selectLocale);
  const { name: company } = useSiteSettings();
  const { data, isLoading, error, refetch } = useGetPublicPostQuery({ slug, locale });
  const post = data?.post;
  const cover = data?.media?.[post?.coverId];
  const jsonLd = useMemo(() => postJsonLd(post, company, imageUrl(cover, 1200) ?? undefined), [post, company, cover]);

  // `||`, not `??`: a SEO field the editor left empty is saved as '', which would leave the site's default title.
  useSeo({
    title: post?.metaTitle || post?.title,
    description: post?.metaDescription || post?.excerpt,
    jsonLd,
  });

  if (error?.status === 404) return <NotFoundPage className="min-h-[60dvh]" />;
  if (error) return <ErrorState error={error} onRetry={refetch} className="min-h-[60dvh]" />;
  if (isLoading || !post) {
    return (
      <div className="container max-w-3xl space-y-4 py-14" aria-hidden>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <PageTransition>
      <PostHeader post={post} cover={cover} />
      <SectionShell>
        <div className="mx-auto max-w-3xl">
          <PostArticle post={post} />
          <PostCta />
        </div>
      </SectionShell>
    </PageTransition>
  );
}
