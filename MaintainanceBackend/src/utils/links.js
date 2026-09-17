import { env } from '../config/env.js';

/**
 * Where a message points. Two kinds of address, and nothing else:
 *
 * - An in-app notification's `link` is an SPA path: `/admin/...` for office staff,
 *   `/tech/...` for technicians and surveyors (their app). The notification panel
 *   navigates to it as it is.
 * - An SMS or email carries an absolute URL on the **web** origin — the SPA — never
 *   APP_URL, which is the API's own address.
 */

/** The SPA's origin: the first PUBLIC_WEB_ORIGIN. */
export const webOrigin = () => env.corsOrigins[0] ?? env.appUrl;

/** An absolute URL on the web origin, for SMS and email. */
export const webUrl = (path) => `${webOrigin()}${path}`;

/** `/admin/leads/:id` — the lead's page in the back office. */
export const adminLeadPath = (id) => `/admin/leads/${id}`;

/** `/admin/quotations/:id` — the quotation's page in the back office. */
export const adminQuotationPath = (id) => `/admin/quotations/${id}`;

/** `/admin/jobs/:id` — the job's page in the back office. */
export const adminJobPath = (id) => `/admin/jobs/${id}`;
