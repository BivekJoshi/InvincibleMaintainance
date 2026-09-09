import { apiSlice } from '@/api/apiSlice';
import { setCredentials, loggedOut } from '@/redux/slices/authSlice';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (r) => r.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setCredentials(data));
      },
      invalidatesTags: ['Auth', 'Dashboard'],
    }),

    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; } finally {
          dispatch(loggedOut());
          dispatch(apiSlice.util.resetApiState());
        }
      },
    }),

    me: build.query({
      query: () => '/auth/me',
      transformResponse: (r) => r.data,
      providesTags: ['Auth'],
    }),

    forgotPassword: build.mutation({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: build.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    changePassword: build.mutation({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Changing the password revokes every session, including this one.
        try { await queryFulfilled; } finally { dispatch(loggedOut()); }
      },
    }),
  }),
});

export const {
  useLoginMutation, useLogoutMutation, useMeQuery,
  useForgotPasswordMutation, useResetPasswordMutation, useChangePasswordMutation,
} = authApi;
