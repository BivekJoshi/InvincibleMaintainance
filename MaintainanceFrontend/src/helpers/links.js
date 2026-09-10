import { BOOKING_PATH, SITE_ROUTES, SITE_ROUTE_PREFIXES } from '@/config/site/siteNav';

/**
 * Link safety for content the CMS supplies.
 *
 * Editors type CTA URLs by hand, and a typo becomes a 404 on the storefront's
 * most valuable button. Anything that is not a route this app serves is sent to
 * the booking page instead — a wrong destination the visitor can still act on
 * beats a dead one.
 */

export const isExternalHref = (url = '') => /^(https?:|tel:|mailto:|viber:)/i.test(url);

/**
 * @param {string} [url] whatever the editor typed
 * @param {string} [fallback] where an unrecognised path lands
 * @returns {string} a URL this app can route to, or an external one untouched
 */
export function siteHref(url, fallback = BOOKING_PATH) {
  if (!url) return fallback;
  if (isExternalHref(url)) return url;
  const path = url.split(/[?#]/)[0];
  if (SITE_ROUTES.includes(path)) return url;
  return SITE_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix)) ? url : fallback;
}
