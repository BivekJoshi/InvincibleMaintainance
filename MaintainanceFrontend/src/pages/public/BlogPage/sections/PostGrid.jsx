import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Media } from '@/components/site/Media';
import { Stagger, StaggerOnView, cardRise } from '@/three/motion/motionKit';
import { formatDate } from '@/helpers/format';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

/** The three states of the post list, on one grid. */
export function PostGrid({ posts, media, isLoading, filtered }) {
  const t = useT(SITE);
  if (isLoading) {
    return (
      <div className={GRID} aria-hidden>
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        title={filtered ? t('blog.empty.filtered') : t('blog.empty.none')}
        description={t('blog.empty.description')}
      />
    );
  }

  return (
    <StaggerOnView className={GRID} stagger={0.05}>
      {posts.map((post) => (
        <Stagger.Item key={post.id} variants={cardRise} className="h-full">
          <Card className="sheen group flex h-full flex-col overflow-hidden card-hover">
            <Link to={`/blog/${post.slug}`} className="relative block" tabIndex={-1} aria-hidden>
              <Media media={media?.[post.coverId]} icon="file-text" zoom />
            </Link>
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {post.category ? <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">{post.category.name}</Badge> : null}
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, { locale: t.locale })}</time>
              </div>
              <h2 className="mt-3 text-[16px] font-semibold leading-snug tracking-tight">
                <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-primary">{post.title}</Link>
              </h2>
              {post.excerpt ? <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
            </CardContent>
          </Card>
        </Stagger.Item>
      ))}
    </StaggerOnView>
  );
}
