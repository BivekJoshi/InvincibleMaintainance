/**
 * Every `import.meta.env` read in the app goes through here, so a missing or
 * renamed variable breaks in one place instead of six. Vite inlines these at
 * build time — they are public, so nothing secret belongs in a VITE_ var.
 */

/** API origin. Empty in dev so Vite's proxy keeps the browser same-origin and the httpOnly refresh cookie works. */
export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/** Where uploaded media is served from. Same-origin in dev via the proxy. */
export const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || '/uploads';

/** Cloudflare Turnstile site key. Absent in dev, which disables the widget. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;
