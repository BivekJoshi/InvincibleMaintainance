import { createSlice } from '@reduxjs/toolkit';
import { hasSessionHint, setSessionHint } from '@/helpers/session';

/**
 * The access token is held in memory only — never localStorage, where any XSS
 * could read it. On a page reload the app calls /auth/refresh, which uses the
 * httpOnly cookie to mint a fresh one.
 *
 * It only makes that call for someone who has signed in on this browser
 * before. Everyone else starts settled as anonymous, so a visitor reading the
 * marketing site never touches an auth endpoint. See `helpers/session`.
 */
const initialState = {
  user: null,
  accessToken: null,
  status: hasSessionHint() ? 'idle' : 'anonymous', // idle | bootstrapping | authenticated | anonymous
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    bootstrapping(state) {
      state.status = 'bootstrapping';
    },
    // The hint is written here rather than at each call site so that every
    // route into these three states keeps it in step, the way uiSlice persists
    // theme and locale.
    setCredentials(state, action) {
      const { user, accessToken } = action.payload;
      if (user) state.user = user;
      state.accessToken = accessToken;
      state.status = 'authenticated';
      setSessionHint(true);
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
      setSessionHint(false);
    },
    // Reached when a refresh fails: the cookie is gone, so the hint is stale.
    anonymous(state) {
      state.status = 'anonymous';
      setSessionHint(false);
    },
  },
});

export const { bootstrapping, setCredentials, loggedOut, anonymous } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s) => s.auth.user;
export const selectRole = (s) => s.auth.user?.role ?? null;
export const selectIsAuthenticated = (s) => Boolean(s.auth.accessToken);
export const selectAuthStatus = (s) => s.auth.status;
