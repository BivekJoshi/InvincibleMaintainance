import { createSlice } from '@reduxjs/toolkit';

/**
 * The access token is held in memory only — never localStorage, where any XSS
 * could read it. On a page reload the app calls /auth/refresh, which uses the
 * httpOnly cookie to mint a fresh one.
 */
const initialState = {
  user: null,
  accessToken: null,
  status: 'idle', // idle | bootstrapping | authenticated | anonymous
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    bootstrapping(state) {
      state.status = 'bootstrapping';
    },
    setCredentials(state, action) {
      const { user, accessToken } = action.payload;
      if (user) state.user = user;
      state.accessToken = accessToken;
      state.status = 'authenticated';
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
    },
    anonymous(state) {
      state.status = 'anonymous';
    },
  },
});

export const { bootstrapping, setCredentials, loggedOut, anonymous } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s) => s.auth.user;
export const selectRole = (s) => s.auth.user?.role ?? null;
export const selectIsAuthenticated = (s) => Boolean(s.auth.accessToken);
export const selectAuthStatus = (s) => s.auth.status;
