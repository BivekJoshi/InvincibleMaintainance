import { useEffect } from 'react';
import { preloadGroup } from '@/routes/routeModules';

/**
 * Pulls the rest of a shell's pages over the wire once the browser is idle, so
 * the second click of a session renders from memory instead of waiting on a
 * chunk. Only the current audience's group is warmed — a visitor reading the
 * marketing site never downloads the back office.
 *
 * @param {'public'|'admin'|'tech'} group
 */
export function useIdlePreload(group) {
  useEffect(() => {
    const run = () => preloadGroup(group);

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1200);
    return () => clearTimeout(id);
  }, [group]);
}
