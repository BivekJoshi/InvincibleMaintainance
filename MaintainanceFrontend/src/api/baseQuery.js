import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, loggedOut } from '@/redux/slices/authSlice';
import { API_URL } from '@/config/env';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  // The refresh token lives in an httpOnly cookie; it must be sent with /auth calls.
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * A single in-flight refresh, shared by every request that 401s at the same moment.
 * Without this, a dashboard firing eight queries would trigger eight refreshes and
 * rotate the token out from under itself.
 */
let refreshPromise = null;

export async function baseQueryWithReauth(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) return result;

  // Never try to refresh the refresh call itself.
  const url = typeof args === 'string' ? args : args?.url ?? '';
  if (url.startsWith('/auth/')) {
    api.dispatch(loggedOut());
    return result;
  }

  if (!refreshPromise) {
    refreshPromise = rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
      .finally(() => { refreshPromise = null; });
  }
  const refreshed = await refreshPromise;

  if (refreshed?.data?.data?.accessToken) {
    api.dispatch(setCredentials(refreshed.data.data));
    result = await rawBaseQuery(args, api, extraOptions);
  } else {
    api.dispatch(loggedOut());
  }
  return result;
}

/** Unwraps the API's `{ data, meta }` envelope into RTK Query's cache shape. */
export const unwrap = (response) => response?.data ?? response;
export const unwrapWithMeta = (response) => ({ items: response?.data ?? [], meta: response?.meta ?? null });
