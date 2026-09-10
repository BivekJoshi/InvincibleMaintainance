/**
 * The three things the company sells before it sells a trade.
 *
 * Every surface that repeats them — the utility strip, the service card, the
 * service page, the footer — reads them from here, so the promise is one
 * sentence in the codebase rather than five that slowly disagree.
 */

export const SITE_PROMISES = [
  { label: 'Free inspection', icon: 'wallet', detail: 'No visiting charge, quote or not' },
  { label: '2-hour response', icon: 'clock', detail: 'Every working day' },
  { label: '1-month warranty', icon: 'shield-check', detail: 'Written, on every job' },
];

/** The same three as plain text, for a strip that has no room for marks. */
export const SITE_PROMISE_LABELS = SITE_PROMISES.map((p) => p.label);
