import { ProseBody } from '@/components/site/ProseBody';

/** The excerpt as a standfirst, then the body as the editor wrote it (plain paragraphs). */
export function PostArticle({ post }) {
  return (
    <article>
      {post.excerpt ? <p className="mb-8 border-l-2 border-gold pl-4 text-[17px] leading-relaxed">{post.excerpt}</p> : null}
      <ProseBody body={post.body} className="max-w-none text-[15px]" />
    </article>
  );
}
