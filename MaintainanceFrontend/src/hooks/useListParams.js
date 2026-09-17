import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Params the API reads as numbers. Everything else stays a string, as the URL has it. */
const NUMERIC = new Set(['page', 'limit']);

/**
 * URL → list params. Defaults first, then whatever the URL carries. Booleans come
 * back as `'true'` / `'false'`, which is what the API's query parser expects.
 *
 * @param {URLSearchParams} searchParams
 * @param {object} [defaults]
 */
export function parseListParams(searchParams, defaults = {}) {
  const out = { ...defaults };
  for (const [k, v] of searchParams.entries()) {
    if (v !== '') out[k] = NUMERIC.has(k) ? Number(v) : v;
  }
  return out;
}

/**
 * List params → a plain object for the URL. Empty values are dropped, and so is
 * `page=1`, so a fresh list has a clean address.
 *
 * @param {object} next
 * @returns {Record<string, string>}
 */
export function serializeListParams(next) {
  const clean = {};
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined && v !== null && v !== '' && !(k === 'page' && Number(v) === 1)) {
      clean[k] = String(v);
    }
  }
  return clean;
}

/**
 * Keeps list filters in the URL, so a filtered view is shareable and survives a
 * reload and the back button. Returns params ready to pass straight to an RTK
 * Query hook.
 *
 * `defaults` is compared by value: callers pass an inline object, and keying the
 * memo on its identity recomputed the params — and re-ran the query hook's
 * argument comparison — on every render.
 *
 * @param {object} [defaults]
 * @returns {[object, (next: object) => void]}
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsKey = JSON.stringify(defaults);

  const params = useMemo(
    () => parseListParams(searchParams, JSON.parse(defaultsKey)),
    [searchParams, defaultsKey],
  );

  const setParams = useCallback((next) => {
    setSearchParams(serializeListParams(next), { replace: true });
  }, [setSearchParams]);

  return [params, setParams];
}
