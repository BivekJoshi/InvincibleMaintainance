import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list filters in the URL, so a filtered view is shareable and survives
 * a back button. Returns params ready to pass straight to an RTK Query hook.
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const out = { ...defaults };
    for (const [k, v] of searchParams.entries()) {
      if (v !== '') out[k] = k === 'page' || k === 'limit' ? Number(v) : v;
    }
    return out;
  }, [searchParams, defaults]);

  const setParams = useCallback((next) => {
    const clean = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined && v !== null && v !== '' && !(k === 'page' && v === 1)) {
        clean[k] = String(v);
      }
    }
    setSearchParams(clean, { replace: true });
  }, [setSearchParams]);

  return [params, setParams];
}
