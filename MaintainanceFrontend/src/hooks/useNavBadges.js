import { useGetBreachedLeadCountQuery } from '@/api/dashboardApi';
import { SHELL_POLL_MS } from '@/config/constants';
import { can } from '@/helpers/permissions';

/**
 * The live counts beside nav items, keyed by an item's `badge`. Polled at the shell's
 * cadence, and only for a role that can open the screen.
 *
 * @param {string|null} role
 * @returns {{ slaBreached?: number }}
 */
export function useNavBadges(role) {
  const { data: slaBreached } = useGetBreachedLeadCountQuery(undefined, {
    skip: !can(role, 'leads:read'),
    pollingInterval: SHELL_POLL_MS,
  });
  return { slaBreached };
}
