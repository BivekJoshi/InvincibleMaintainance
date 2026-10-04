import { EASE } from '@/three/motion/motionKit';

/**
 * The figures on the sign-in stage, and its credo. Copy, not logic — kept out of the
 * components so a change of wording is a one-line edit that touches no markup.
 *
 * Phase J1: the screen's words are `login.*` in `config/i18n/site.js`. The credo stays here: it is shown in both
 * languages at once, whichever one the screen is in, so it is not a translation to pick from.
 */

/** Cycles under the wordmark on the dark panel. Decoration — never the only copy. */
export const CREDO = [
  { en: 'Every job answered inside two hours.', ne: 'हरेक काम दुई घण्टाभित्र।' },
  { en: 'Certified engineers. Transparent pricing.', ne: 'प्रमाणित इन्जिनियर। पारदर्शी मूल्य।' },
  { en: 'Warranty tracked from the first visit.', ne: 'पहिलो भ्रमणदेखि वारेन्टी।' },
];

/** How long each credo holds before the next one takes over. */
export const CREDO_INTERVAL = 5600;

/** Each one's label is `login.stats.<key>`; `unit` names the word after the figure (`login.stats.hours`). */
export const STATS = [
  { key: 'response', value: 2, unit: 'hours' },
  { key: 'services', value: 18 },
  // A year is a label, not a quantity — counting up to it looks like a bug.
  { key: 'established', value: 2016, plain: true },
];

/** Only rendered by `npm run dev`. The seed gives every account the same password. */
export const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@gharjatan.com.np' },
  { role: 'Sales', email: 'sales@gharjatan.com.np' },
  { role: 'Dispatch', email: 'dispatch@gharjatan.com.np' },
  { role: 'Accounts', email: 'accounts@gharjatan.com.np' },
  { role: 'Technician', email: 'hari@gharjatan.com.np' },
];

export const DEMO_PASSWORD = 'Password123';

/** The entrance every block on this page shares. */
export const LOGIN_RISE = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
