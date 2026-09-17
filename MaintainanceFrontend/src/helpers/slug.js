/**
 * URL slug, a copy of the API's `MaintainanceBackend/src/utils/slug.js` — change the
 * two together. The form previews the slug with this; the API runs the same function
 * again and appends -2, -3… if the slug is taken.
 *
 * Devanagari is kept as-is and nothing is transliterated. Marks (\p{M}) belong to
 * the word: vowel signs, the virama and the anusvara are all marks.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function slugify(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
