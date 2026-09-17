import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Holds a navigation away from a form with unsaved changes until someone decides.
 *
 * In-app links and the back button go through `useBlocker` (which needs the data
 * router `AppProviders` sets up); closing or reloading the tab goes through
 * `beforeunload`, where the browser shows its own prompt. Only a change of pathname
 * counts as leaving — a tab or a filter rewriting the query string does not.
 *
 * When `blocker.state === 'blocked'`, render a confirmation and call
 * `blocker.proceed()` or `blocker.reset()`.
 *
 * `setBypass(true)` lets navigations through while a save is in flight, because the
 * redirect after a successful save happens before the form is marked clean.
 *
 * @param {boolean} when
 * @returns {{ blocker: import('react-router-dom').Blocker, setBypass: (bypass: boolean) => void }}
 */
export function useUnsavedChangesGuard(when) {
  const whenRef = useRef(when);
  whenRef.current = when;
  const bypassRef = useRef(false);

  const shouldBlock = useCallback(({ currentLocation, nextLocation }) => (
    whenRef.current && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname
  ), []);

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  // A navigation held while the form was dirty can go once it no longer is.
  useEffect(() => {
    if (blocker.state === 'blocked' && !when) blocker.proceed();
  }, [blocker, when]);

  const setBypass = useCallback((bypass) => { bypassRef.current = bypass; }, []);

  return { blocker, setBypass };
}
