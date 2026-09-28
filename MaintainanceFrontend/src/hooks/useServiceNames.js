import { useMemo } from 'react';
import { useSearchRecordsQuery } from '@/api/lookupApi';
import { useAuth } from '@/hooks/useAuth';
import { SERVICE_LOOKUP } from '@/config/admin/aftercareViews';

/**
 * The service catalogue's names, for an AMC contract's covered services (Phase I). Read only while `enabled`
 * (a sheet that is open) and only with `services:read`; otherwise an empty list, and the form types them instead.
 *
 * @param {boolean} enabled
 * @returns {string[]}
 */
export function useServiceNames(enabled) {
  const { can } = useAuth();
  const { data } = useSearchRecordsQuery(SERVICE_LOOKUP, { skip: !enabled || !can('services:read') });
  return useMemo(() => [...new Set((data ?? []).map((s) => s.name).filter(Boolean))], [data]);
}
