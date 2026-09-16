import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapping, setCredentials, anonymous, selectAuthStatus } from '@/redux/slices/authSlice';
import { API_URL } from '@/config/env';

/**
 * Side-effect-only component: restores the session, once, in the background.
 *
 * On a cold load there is no access token in memory — only the httpOnly refresh
 * cookie — so a signed-in user would otherwise be bounced to the login screen
 * by their own page refresh. This asks the API for a fresh token to prevent
 * that.
 *
 * Two things it deliberately does not do. It does not ask on behalf of someone
 * who has never signed in here: the slice starts settled as anonymous unless
 * `helpers/session` says otherwise, so the marketing site makes no auth call at
 * all. And it does not hold the tree back while it waits — it used to render a
 * full-screen spinner in front of every page, which put a round trip that
 * public visitors had no use for in front of the hero. The two places that
 * genuinely need a settled session — `RequireAuth` and the login page — wait
 * for `useAuth().isReady` themselves.
 */
/**
 * The page's one restore. The refresh token rotates on every use, so two requests with the
 * same cookie race: the second is refused, and if its 401 lands last it signs the user out.
 * React's StrictMode runs this effect twice on mount in development, which did exactly that
 * on an occasional reload.
 *
 * @type {Promise<object>|null}
 */
let restoring = null;

export function SessionEffect() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);

  useEffect(() => {
    if (status !== 'idle') return;
    dispatch(bootstrapping());
    restoring ??= fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
    restoring
      .then((json) => dispatch(setCredentials(json.data)))
      .catch(() => dispatch(anonymous()));
  }, [dispatch, status]);

  return null;
}
