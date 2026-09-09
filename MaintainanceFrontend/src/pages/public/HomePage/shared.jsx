import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * The bits more than one home-page section needs. Anything used by exactly
 * one section stays in that section's own file.
 */

/** The rise-into-place a card uses when its grid scrolls in. */
export const RISE = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/** Hover behaviour shared by every clickable card on the page. */
export const CARD_HOVER = 'transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card';

// ── link safety ────────────────────────────────────────────────────────────────
// Editors type CTA URLs by hand. Anything that is not a route this app serves
// goes to the booking page rather than to a 404.
const ROUTES = ['/', '/services', '/pricing', '/contact', '/book'];
const isExternal = (url = '') => /^(https?:|tel:|mailto:|viber:)/i.test(url);

function siteHref(url, fallback = '/book') {
  if (!url) return fallback;
  if (isExternal(url)) return url;
  const path = url.split(/[?#]/)[0];
  return ROUTES.includes(path) || path.startsWith('/services/') || path.startsWith('/book/') ? url : fallback;
}

export function Cta({ href, children, ...props }) {
  const target = siteHref(href);
  return (
    <Button asChild {...props}>
      {isExternal(target) ? <a href={target}>{children}</a> : <Link to={target}>{children}</Link>}
    </Button>
  );
}
