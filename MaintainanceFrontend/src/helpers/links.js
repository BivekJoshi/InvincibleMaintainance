import { BOOKING_PATH, SITE_ROUTES, SITE_ROUTE_PREFIXES } from '@/config/site/siteNav';

/**
 * Link safety for content the CMS supplies.
 *
 * Editors type CTA URLs by hand, and a typo becomes a 404 on the storefront's
 * most valuable button. Anything that is not a route this app serves is sent to
 * the booking page instead — a wrong destination the visitor can still act on
 * beats a dead one.
 *
 * A generic page (`/about`) is a route only while it exists and is switched on, so
 * those are checked against the live page slugs from `/public/bootstrap`.
 */

export const isExternalHref = (url = '') => /^(https?:|tel:|mailto:|viber:)/i.test(url);

/** Is `path` a page of this site? `pageSlugs` are the live generic pages. */
export function isSitePath(path, pageSlugs = []) {
  if (SITE_ROUTES.includes(path)) return true;
  if (SITE_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  const single = /^\/([^/]+)$/.exec(path);
  return Boolean(single && pageSlugs.includes(decodeURIComponent(single[1])));
}

/**
 * @param {string} [url] whatever the editor typed
 * @param {string} [fallback] where an unrecognised path lands
 * @param {string[]} [pageSlugs] the live generic pages
 * @returns {string} a URL this app can route to, or an external one untouched
 */
export function siteHref(url, fallback = BOOKING_PATH, pageSlugs = []) {
  if (!url) return fallback;
  if (isExternalHref(url)) return url;
  return isSitePath(url.split(/[?#]/)[0], pageSlugs) ? url : fallback;
}

export const LINK_HINT = 'Use a page of this site (/book, /services/…, /pricing, /blog, a page such as /about) or a full https://, tel: or mailto: link';

/**
 * The admin form's check for a CMS link: the message to show, or null when the site
 * would follow the link as typed.
 *
 * @param {string} [url]
 * @param {string[]} [pageSlugs]
 */
export const linkIssue = (url, pageSlugs = []) => (url && siteHref(url, null, pageSlugs) !== url ? LINK_HINT : null);
