import { Link } from 'react-router-dom';
import { Breadcrumb } from '@/components/site/Breadcrumb';
import { Media } from '@/components/site/Media';
import { formatDate } from '@/helpers/format';

/** Trail, title, date and category, then the cover when there is one. */
export function PostHeader({ post, cover }) {
  return (
    <section className="border-b bg-muted/40">
      <div className="container max-w-3xl py-10 md:py-14">
        <Breadcrumb items={[{ label: 'Blog', to: '/blog' }, { label: post.title }]} />
        <h1 className="mt-4 text-[1.9rem] font-bold leading-[1.15] tracking-tight md:text-4xl">{post.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, { day: 'numeric', month: 'long' })}</time>
          {post.category ? (
            <>
              <span aria-hidden>·</span>
              <Link to={`/blog?category=${post.category.slug}`} className="transition-colors hover:text-foreground">{post.category.name}</Link>
            </>
          ) : null}
        </p>
        {cover ? (
          <div className="mt-8 overflow-hidden rounded-xl border">
            <Media media={cover} alt={cover.alt ?? ''} ratio={16 / 9} width={1200} priority />
          </div>
        ) : null}
      </div>
    </section>
  );
}
