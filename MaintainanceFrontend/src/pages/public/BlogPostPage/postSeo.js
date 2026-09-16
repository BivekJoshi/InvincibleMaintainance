/**
 * The structured data a blog post publishes: an Article, so a search result can show
 * the date and the publisher.
 *
 * @param {object|undefined} post the resolved post row
 * @param {string} companyName
 * @param {string} [imageUrl] the cover, when there is one
 * @returns {object|null} JSON-LD, or null before the post has loaded
 */
export function postJsonLd(post, companyName, imageUrl) {
  if (!post) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    // `||`, not `??`: a SEO field the editor left empty is saved as ''.
    headline: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { '@type': 'Organization', name: companyName },
    publisher: { '@type': 'Organization', name: companyName },
    ...(imageUrl ? { image: imageUrl } : {}),
  };
}
