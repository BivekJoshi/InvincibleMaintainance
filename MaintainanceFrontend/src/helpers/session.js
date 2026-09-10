/**
 * A readable hint that a refresh cookie probably exists.
 *
 * The refresh token is httpOnly on purpose, so no script can read it — which
 * also means the app cannot tell a signed-in staff member from a first-time
 * visitor without asking the API. Asking unconditionally charged every
 * anonymous visitor to the marketing site a round trip to `/auth/refresh` that
 * was always going to 401, and the whole site waited on it.
 *
 * So signing in writes this flag and signing out clears it. It holds no token
 * and grants nothing: a forged flag buys one 401 and is then cleared. If it
 * goes stale — the cookie expired but the flag survived — the first failed
 * refresh heals it.
 */
const KEY = 'hasSession';

export function hasSessionHint() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch { /* private mode */ }
}
