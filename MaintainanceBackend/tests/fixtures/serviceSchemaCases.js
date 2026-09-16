/**
 * Service form inputs and whether the service schema accepts them. Plain data with no
 * imports: the API's unit tests run these against shared/schemas/cms.js, and the SPA's
 * against its mirror in src/form/schemas/cms.schema.js — the two must agree on every case.
 */

const excerpt = 'Rust treatment, primer and two topcoats on steel gates, with the hinges serviced while we are there.';

export const SERVICE_BASE = { name: 'Gate Painting', excerpt };

/** @type {{ name: string, input: object, valid: boolean, path?: string }[]} */
export const SERVICE_SCHEMA_CASES = [
  { name: 'genuine copy', input: {}, valid: true },
  { name: 'Nepali copy', input: { name: 'गेट रङ्ग', excerpt: 'फलामे गेटमा खिया हटाउने, प्राइमर र दुई तह रङ्ग, कब्जाको सर्भिस सहित।' }, valid: true },
  { name: 'excerpt of exactly 40 characters', input: { excerpt: 'x'.repeat(40) }, valid: true },
  { name: 'excerpt of exactly 200 characters', input: { excerpt: 'x'.repeat(200) }, valid: true },
  { name: 'excerpt of 39 characters', input: { excerpt: 'x'.repeat(39) }, valid: false, path: 'excerpt' },
  { name: 'excerpt of 201 characters', input: { excerpt: 'x'.repeat(201) }, valid: false, path: 'excerpt' },
  { name: 'padding does not count toward the minimum', input: { excerpt: `   ${'x'.repeat(38)}   ` }, valid: false, path: 'excerpt' },
  { name: 'missing excerpt', input: { excerpt: undefined }, valid: false, path: 'excerpt' },
  {
    name: 'the old site’s boilerplate',
    input: { excerpt: 'Professional gate painting with expert tools and results.' },
    valid: false,
    path: 'excerpt',
  },
  {
    name: 'the boilerplate in capitals, without the full stop',
    input: { excerpt: 'PROFESSIONAL WATERPROOFING SERVICES WITH EXPERT TOOLS AND RESULTS' },
    valid: false,
    path: 'excerpt',
  },
  {
    name: 'copy that merely mentions expert tools',
    input: { excerpt: 'Professional crack repair — we bring expert tools and results you can see within a day.' },
    valid: true,
  },
  { name: 'a one-letter name', input: { name: 'G' }, valid: false, path: 'name' },
  { name: 'a price range', input: { priceFrom: 100, priceTo: 500, priceUnit: 'sq.ft' }, valid: true },
  { name: 'an equal price range', input: { priceFrom: 250.5, priceTo: 250.5 }, valid: true },
  { name: 'only a starting price', input: { priceFrom: 100 }, valid: true },
  { name: 'a maximum below the minimum', input: { priceFrom: 500, priceTo: 100 }, valid: false, path: 'priceTo' },
  { name: 'a negative price', input: { priceFrom: -1 }, valid: false, path: 'priceFrom' },
  { name: 'an unknown unit', input: { priceFrom: 100, priceUnit: 'acre' }, valid: false, path: 'priceUnit' },
  { name: 'an unknown type', input: { type: 'luxury' }, valid: false, path: 'type' },
  { name: 'a warranty over ten years', input: { warrantyDays: 3651 }, valid: false, path: 'warrantyDays' },
];
