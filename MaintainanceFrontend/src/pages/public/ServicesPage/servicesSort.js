/**
 * How the catalogue is ordered, and how a search narrows it.
 *
 * Both run on the page of services the API already returned, not on the
 * database: filtering by category is a server query because it changes what
 * is fetched, but re-sorting twenty rows the browser is holding should not
 * cost a round trip per keystroke.
 */

export const SERVICE_SORTS = {
  recommended: { label: 'Recommended', compare: null },
  'price-asc': { label: 'Price: low to high', compare: (a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity) },
  'price-desc': { label: 'Price: high to low', compare: (a, b) => (b.priceFrom ?? -1) - (a.priceFrom ?? -1) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

export const DEFAULT_SERVICE_SORT = 'recommended';

/**
 * @param {object[]} services the page the API returned
 * @param {string} q free text, matched against name, excerpt and category
 * @param {string} sort a key of SERVICE_SORTS
 * @returns {object[]} a new array — the query's cached result is never mutated
 */
export function selectServices(services = [], q = '', sort = DEFAULT_SERVICE_SORT) {
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? services.filter((s) =>
      [s.name, s.excerpt, s.category?.name].filter(Boolean).join(' ').toLowerCase().includes(needle))
    : services;

  const compare = SERVICE_SORTS[sort]?.compare;
  return compare ? [...filtered].sort(compare) : filtered;
}
