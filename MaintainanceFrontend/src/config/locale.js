/** Display conventions. The DB stores UTC and integer paisa; these decide how it reads. */

export const TIMEZONE = 'Asia/Kathmandu';   // +05:45
export const CURRENCY = 'NPR';
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'ne'];

/** Nepali mobile (98/97/96 + 8 digits) or a landline with an area code. */
export const NEPAL_PHONE = /^(?:9[678]\d{8}|0\d{1,2}-?\d{6,7})$/;

/** Strips spaces, brackets and a +977 country prefix before validation. */
export const normalisePhone = (v = '') => v.replace(/[\s()]/g, '').replace(/^\+?977-?/, '');
