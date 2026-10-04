/** Display conventions. The DB stores UTC and integer paisa; these decide how it reads. */

export const TIMEZONE = 'Asia/Kathmandu';   // +05:45
/** Nepal has kept a fixed +05:45 with no daylight saving since 1986, so a constant is exact. */
export const TIMEZONE_OFFSET_MINUTES = 345;
export const CURRENCY = 'NPR';
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'ne'];

/**
 * The digits Nepali screens print (Phase J1): `'latin'` (1,25,000) or `'deva'` (१,२५,०००). Latin by default — a
 * customer reads an amount, a job number or a phone back to the office, and a technician types Latin digits into
 * every input. Display only: nothing in an input or a request body is ever converted (`helpers/format.js`).
 */
export const NE_DISPLAY_DIGITS = 'latin';

/**
 * Noto Sans Devanagari from Google Fonts, fetched only while Nepali is on (J1.7) — by the script in `index.html` for
 * a page that opens in Nepali, by `providers/LocaleEffect.jsx` when someone switches. The CSS carries `unicode-range`
 * subsets, and Inter comes first in the font stack, so only the Devanagari subset's files are downloaded.
 * `display=optional`: a font that is not ready at once is skipped for that page (the system's Devanagari face is
 * used) rather than swapped in later, so nothing reflows. `index.html` repeats this URL; a test holds them equal.
 */
export const DEVANAGARI_FONT_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=optional';

/** Paths whose screens stay English whatever the visitor chose (decision D7: the back office is not translated). */
export const isEnglishOnlyPath = (pathname = '') => pathname === '/admin' || pathname.startsWith('/admin/');

/** Nepali mobile (98/97/96 + 8 digits) or a landline with an area code. */
export const NEPAL_PHONE = /^(?:9[678]\d{8}|0\d{1,2}-?\d{6,7})$/;

/** Strips spaces, brackets and a +977 country prefix before validation. */
export const normalisePhone = (v = '') => v.replace(/[\s()]/g, '').replace(/^\+?977-?/, '');
