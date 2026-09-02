import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { bootstrapping, setCredentials, anonymous, selectAuthStatus } from '@/features/auth/authSlice';

/**
 * On a cold load there is no access token in memory — only the httpOnly refresh
 * cookie. This asks the API for a fresh token once, before any route renders,
 * so a page refresh does not bounce a signed-in user to the login screen.
 */
export function AuthGate({ children }) {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);

  useEffect(() => {
    if (status !== 'idle') return;
    dispatch(bootstrapping());
    fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json) => dispatch(setCredentials(json.data)))
      .catch(() => dispatch(anonymous()));
  }, [dispatch, status]);

  if (status === 'idle' || status === 'bootstrapping') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return children;
}
