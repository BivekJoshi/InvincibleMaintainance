import { useCallback, useEffect, useRef, useState } from 'react';
import { useSyncOfflineMutation } from '@/api/techApi';
import { flush, pending } from '@/helpers/offlineQueue';

/**
 * Watches the field queue and drains it whenever the device is back online.
 * Returns the pending count so the shell can say so out loud — a surveyor needs
 * to know their work has not reached the office yet.
 */
export function useOfflineQueue() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [sync] = useSyncOfflineMutation();

  const refresh = useCallback(async () => {
    try {
      setCount((await pending()).length);
    } catch {
      setCount(0); // No IndexedDB (private mode) — the queue simply is not available.
    }
  }, []);

  const drain = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    try {
      await flush((body) => sync(body).unwrap());
    } catch {
      // Still offline, or the server is down. The queue keeps its entries.
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [sync, syncing, refresh]);

  useEffect(() => {
    refresh();
    const goOnline = () => { setOnline(true); drain(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, [refresh, drain]);

  // One attempt on mount, in case the app was opened after coming back online.
  // Held in a ref so this runs exactly once, not again whenever drain's identity changes.
  const drainOnMount = useRef(drain);
  useEffect(() => { drainOnMount.current(); }, []);

  return { count, online, syncing, drain, refresh };
}
