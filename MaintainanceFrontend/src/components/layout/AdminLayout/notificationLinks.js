/** Customer-facing token pages. A staff notification may point at one; it is not an admin page. */
const PUBLIC_PREFIXES = ['/quotation/', '/invoice/', '/warranty/'];

/**
 * Where a notification's `link` goes inside the SPA.
 *
 * The API writes links three ways: admin paths without the `/admin` prefix
 * (`/leads/:id`, `/quotations/:id`), full ones (`/admin/surveys/:id`, `/tech/jobs/:id`),
 * and absolute URLs built from the app origin (`https://…/leads/:id`). All of them
 * become one in-app path, so a click never leaves the back office. A query string is kept:
 * Phase L1's reminders link to `/admin/leads/:id?markLost=1` (a declined or expired quotation
 * opens the Mark lost dialog) and `/admin/leads?nextAction=due_today` (the follow-up digest).
 *
 * @param {string|null|undefined} link
 * @returns {string|null} an in-app path, or null when there is nowhere to go
 */
export function notificationHref(link) {
  if (!link || typeof link !== 'string') return null;
  let path = link.trim();

  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null;

  if (path === '/admin' || /^\/(admin|tech)([/?#]|$)/.test(path)) return path;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return path;
  return `/admin${path}`;
}
