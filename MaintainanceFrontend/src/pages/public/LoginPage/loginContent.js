import { EASE } from '@/three/motion/motionKit';

/**
 * The words and figures on the sign-in stage. Copy, not logic — kept out of the
 * components so a change of wording is a one-line edit that touches no markup.
 */

/** Cycles under the wordmark on the dark panel. Decoration — never the only copy. */
export const CREDO = [
  { en: 'Every job answered inside two hours.', ne: 'हरेक काम दुई घण्टाभित्र।' },
  { en: 'Certified engineers. Transparent pricing.', ne: 'प्रमाणित इन्जिनियर। पारदर्शी मूल्य।' },
  { en: 'Warranty tracked from the first visit.', ne: 'पहिलो भ्रमणदेखि वारेन्टी।' },
];

/** How long each credo holds before the next one takes over. */
export const CREDO_INTERVAL = 5600;

export const STATS = [
  { value: 2, suffix: 'h', label: 'Response SLA' },
  { value: 18, suffix: '', label: 'Services' },
  // A year is a label, not a quantity — counting up to it looks like a bug.
  { value: 2016, suffix: '', label: 'Established', plain: true },
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
