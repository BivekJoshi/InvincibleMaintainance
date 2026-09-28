import { useCallback, useMemo } from 'react';
import { useListParams } from '@/hooks/useListParams';
import { defaultReportRange } from '@/helpers/finance';

/**
 * A report page's filters in the URL (Phase I): `from` / `to` (Kathmandu days — the last 30 unless the address says
 * otherwise, so the page, its query and its CSV all name the same range), the report's tab and anything else it
 * filters by. `patch` merges a change into the current params.
 *
 * @param {object} [defaults]  more defaults (`{ report: 'aging' }`)
 * @returns {[object, (patch: object) => void, (next: object) => void]}
 */
export function useReportParams(defaults = {}) {
  const range = useMemo(() => defaultReportRange(), []);
  const [params, setParams] = useListParams({ ...range, ...defaults });
  const patch = useCallback((next) => setParams({ ...params, ...next }), [params, setParams]);
  return [params, patch, setParams];
}

/** The params a report's query and CSV take: the range, and a grouping when it has one. */
export const reportQueryParams = ({ from, to, groupBy }) => ({ from, to, ...(groupBy ? { groupBy } : {}) });
