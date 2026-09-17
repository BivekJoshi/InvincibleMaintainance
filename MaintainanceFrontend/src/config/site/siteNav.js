/**
 * The public site's navigation, in one place, so the header, the mobile drawer
 * and the footer can never drift out of step.
 */

export const SITE_NAV = [
  { to: '/services', label: 'Services', mega: true },
  { to: '/projects', label: 'Our work' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

/** Listed only while the blog has a published post (`nav.blog` from `/public/bootstrap`). */
export const BLOG_NAV = { to: '/blog', label: 'Blog' };

/**
 * The nav for what the site currently has. An empty blog is a dead end, so its link
 * appears only once a post is published — just before Contact.
 *
 * @param {{ blog?: boolean }} [nav] `nav` from `/public/bootstrap`
 */
export function siteNavFor(nav) {
  if (!nav?.blog) return SITE_NAV;
  const contact = SITE_NAV.findIndex((n) => n.to === '/contact');
  return [...SITE_NAV.slice(0, contact), BLOG_NAV, ...SITE_NAV.slice(contact)];
}

/** Where a route lands when an editor types a CTA URL that is not one of ours. */
export const BOOKING_PATH = '/book';

/** Paths this app actually serves, for validating hand-typed CTA links. */
export const SITE_ROUTES = ['/', '/services', '/projects', '/pricing', '/contact', '/book', '/blog'];

/** Prefixes under which any slug is a real page. */
export const SITE_ROUTE_PREFIXES = ['/services/', '/projects/', '/book/', '/blog/'];

/**
 * First path segments the app routes itself. A generic CMS page at `/:slug` is only
 * reachable when its slug is none of these, because the fixed route wins.
 */
export const RESERVED_SLUGS = [
  'services', 'projects', 'pricing', 'contact', 'book', 'blog', 'quotation', 'invoice', 'warranty',
  'login', 'admin', 'tech', 'api', 'uploads', 'sitemap.xml', 'robots.txt',
];
