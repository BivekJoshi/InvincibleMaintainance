/**
 * The three things the company sells before it sells a trade.
 *
 * Every surface that repeats them — the utility strip, the service card, the
 * service page, the footer — reads them from here, so the promise is one
 * sentence in the codebase rather than five that slowly disagree.
 *
 * Phase J1: the words are `promises.<key>.label` and `.detail` in `config/i18n/site.js`, in English and Nepali;
 * this list holds the order and the marks.
 */

export const SITE_PROMISES = [
  { key: 'inspection', icon: 'wallet' },
  { key: 'response', icon: 'clock' },
  { key: 'warranty', icon: 'shield-check' },
];
