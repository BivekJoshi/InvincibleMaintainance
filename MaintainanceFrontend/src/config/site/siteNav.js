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

/** Where a route lands when an editor types a CTA URL that is not one of ours. */
export const BOOKING_PATH = '/book';

/** Paths this app actually serves, for validating hand-typed CTA links. */
export const SITE_ROUTES = ['/', '/services', '/projects', '/pricing', '/contact', '/book'];

/** Prefixes under which any slug is a real page. */
export const SITE_ROUTE_PREFIXES = ['/services/', '/projects/', '/book/'];
