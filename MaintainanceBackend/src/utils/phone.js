/** Nepali mobile (98/97 + 8 digits) or landline (0XX-XXXXXX). */
export const NEPAL_PHONE_RE = /^(?:9[678]\d{8}|0\d{1,2}-?\d{6,7})$/;

export const isNepaliPhone = (v) => NEPAL_PHONE_RE.test(normalizePhone(v));

/** Strips spaces, +977 country code and separators so duplicates collapse. */
export function normalizePhone(input) {
  let v = String(input || '').trim().replace(/[\s()]/g, '');
  v = v.replace(/^\+?977[-]?/, '');
  return v;
}
