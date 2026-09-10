import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { isExternalHref, siteHref } from '@/helpers/links';

/**
 * A call to action whose destination came from the CMS.
 *
 * An editor's typo must not become a dead button on the storefront's most
 * valuable link, so the URL is checked against the routes this app serves and
 * anything unrecognised falls back to booking — see `helpers/links.js`.
 * External schemes (tel:, viber:, https:) are passed through as real anchors,
 * because <Link> would push them onto the router as a path.
 */
export function Cta({ href, children, ...props }) {
  const target = siteHref(href);
  return (
    <Button asChild {...props}>
      {isExternalHref(target) ? <a href={target}>{children}</a> : <Link to={target}>{children}</Link>}
    </Button>
  );
}
