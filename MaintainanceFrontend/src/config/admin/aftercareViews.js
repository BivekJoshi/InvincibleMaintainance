/**
 * The aftercare lists' tabs (Phase I), each a set of list params kept in the URL under `view`, so a tab can be
 * bookmarked and a notification can link straight to one. `viewQuery` turns the URL's params into the API's:
 * the tab's own filter in, `view` (and the tab's helper params) out.
 *
 * A view's `query` is an object, or a function of the URL's params (the "expiring in N days" preset reads `days`).
 */

/** How far ahead "Expiring soon" can look, in days, and where it starts. */
export const EXPIRING_DAY_OPTIONS = [7, 14, 30, 60, 90];
export const DEFAULT_EXPIRING_DAYS = 30;

/** The renewals preset's window (the notification's `?renewals=true` and the dashboard card say 60 days). */
export const RENEWALS_DAYS = 60;

export const WARRANTY_VIEWS = [
  { value: 'all', label: 'All', query: {} },
  { value: 'active', label: 'Active', query: { status: 'ACTIVE' } },
  { value: 'claimed', label: 'Claim open', query: { status: 'CLAIMED' } },
  {
    value: 'expiring',
    label: 'Expiring soon',
    query: (p) => ({ expiringDays: EXPIRING_DAY_OPTIONS.includes(Number(p.days)) ? Number(p.days) : DEFAULT_EXPIRING_DAYS }),
  },
  { value: 'expired', label: 'Expired', query: { status: 'EXPIRED' } },
  { value: 'void', label: 'Void', query: { status: 'VOID' } },
];

/** "All" is the API's own order: open claims first, then accepted, then the rest (newest first within each). */
export const CLAIM_VIEWS = [
  { value: 'all', label: 'All — open first', query: {} },
  { value: 'open', label: 'Open', query: { status: 'open' } },
  { value: 'accepted', label: 'Accepted', query: { status: 'accepted' } },
  { value: 'rejected', label: 'Rejected', query: { status: 'rejected' } },
  { value: 'resolved', label: 'Resolved', query: { status: 'resolved' } },
];

export const AMC_VIEWS = [
  { value: 'active', label: 'Active', query: { status: 'active' } },
  { value: 'renewals', label: `Renewals due (${RENEWALS_DAYS} days)`, query: { renewalsDays: RENEWALS_DAYS } },
  { value: 'expired', label: 'Expired', query: { status: 'expired' } },
  { value: 'cancelled', label: 'Cancelled', query: { status: 'cancelled' } },
  { value: 'all', label: 'All', query: {} },
];

export const REMINDER_VIEWS = [
  { value: 'pending', label: 'Pending', query: { status: 'pending' } },
  { value: 'sent', label: 'Sent', query: { status: 'sent' } },
  { value: 'failed', label: 'Failed', query: { status: 'failed' } },
  { value: 'skipped', label: 'Skipped', query: { status: 'skipped' } },
  { value: 'all', label: 'All', query: {} },
];

/** URL params that only choose a view; the API never sees them. */
const VIEW_PARAMS = ['view', 'days', 'renewals'];

/**
 * The tab the URL is on, and the API's query for it.
 *
 * `?renewals=true` (the AMC renewals notification's link) is the renewals preset.
 *
 * @param {{ value: string, query: object|((params: object) => object) }[]} views
 * @param {Record<string, any>} params  the URL's list params
 * @param {string} fallback             the view when the URL names none
 * @returns {{ view: string, query: Record<string, any> }}
 */
export function viewQuery(views, params, fallback) {
  const asked = params.renewals === 'true' && views.some((v) => v.value === 'renewals') ? 'renewals' : params.view;
  const view = views.find((v) => v.value === asked) ?? views.find((v) => v.value === fallback) ?? views[0];
  const rest = Object.fromEntries(Object.entries(params).filter(([k]) => !VIEW_PARAMS.includes(k)));
  const own = typeof view.query === 'function' ? view.query(params) : view.query;
  return { view: view.value, query: { ...rest, ...own } };
}

/**
 * The URL params after picking a tab: page 1, the tab's name, and nothing left from the last tab's helpers
 * (a renewals link's `renewals=true` would otherwise win over every click).
 */
export function selectView(params, view) {
  const rest = Object.fromEntries(Object.entries(params).filter(([k]) => !VIEW_PARAMS.includes(k)));
  return { ...rest, page: 1, view };
}

/** A status's badge tone (`StateBadge`): `danger` is drawn on the destructive surface. */
export const WARRANTY_TONE = { ACTIVE: 'success', CLAIMED: 'warning', EXPIRED: 'muted', VOID: 'danger' };
export const CLAIM_TONE = { open: 'warning', accepted: 'info', rejected: 'muted', resolved: 'success' };
export const AMC_TONE = { active: 'success', expired: 'muted', cancelled: 'danger' };
export const AMC_VISIT_TONE = { pending: 'muted', scheduled: 'info', completed: 'success', missed: 'danger' };
export const REMINDER_TONE = { pending: 'info', sent: 'success', failed: 'danger', skipped: 'muted' };

/** Services, as the AMC form's covered-services list and the reminder form pick them. */
export const SERVICE_LOOKUP = { path: '/admin/services', limit: 100, params: { onlyActive: 'true' } };
