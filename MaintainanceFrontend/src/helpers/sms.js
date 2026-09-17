/**
 * How many SMS parts a message costs.
 *
 * A message written only in the GSM 7-bit alphabet fits 160 characters in one SMS, 153 per
 * part once it is split (the rest carries the part header). The extension characters
 * (`{ } [ ] ~ \ | ^ €` and form feed) take two places each. Anything else — Devanagari,
 * curly quotes, most emoji — sends the whole message as Unicode (UCS-2): 70 per SMS, 67 per
 * part, and a character outside the Basic Multilingual Plane takes two.
 */

const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
  + '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM_EXTENSION = new Set('^{}\\[~]|€\f');

export const SMS_LIMITS = {
  gsm: { single: 160, part: 153 },
  unicode: { single: 70, part: 67 },
};

/**
 * @param {string} text
 * @returns {{ encoding: 'GSM-7'|'Unicode', length: number, segments: number, perSegment: number,
 *   remaining: number, nonGsm: string[] }}
 *   `length` is in the encoding's own units; `remaining` is what fits before another part;
 *   `nonGsm` lists the characters that made it Unicode (up to 10).
 */
export function smsSegments(text = '') {
  const chars = [...String(text ?? '')];
  const nonGsm = [...new Set(chars.filter((c) => !GSM_BASIC.has(c) && !GSM_EXTENSION.has(c)))];
  const unicode = nonGsm.length > 0;
  const limits = unicode ? SMS_LIMITS.unicode : SMS_LIMITS.gsm;
  const length = unicode
    ? String(text ?? '').length // UTF-16 code units: an astral character is two
    : chars.reduce((n, c) => n + (GSM_EXTENSION.has(c) ? 2 : 1), 0);
  const segments = length === 0 ? 0 : length <= limits.single ? 1 : Math.ceil(length / limits.part);
  const perSegment = segments > 1 ? limits.part : limits.single;
  return {
    encoding: unicode ? 'Unicode' : 'GSM-7',
    length,
    segments,
    perSegment,
    remaining: Math.max(0, Math.max(segments, 1) * perSegment - length),
    nonGsm: nonGsm.slice(0, 10),
  };
}
