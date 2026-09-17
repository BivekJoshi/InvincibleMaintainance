import { apiSlice, tagList } from '@/api/apiSlice';

/**
 * Staff accounts (ADMIN). Every change lands in the audit log and may touch sign-in state,
 * so writes also invalidate `AuditLog`, `LoginActivity` and `History`.
 */
const AFTER_WRITE = ['AuditLog', 'LoginActivity', 'History'];
const userTags = (id) => [{ type: 'User', id }, { type: 'User', id: 'LIST' }, ...AFTER_WRITE];

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query({
      query: (params = {}) => ({ url: '/admin/users', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('User'),
    }),
    getUser: build.query({
      query: (id) => `/admin/users/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    createUser: build.mutation({
      query: (body) => ({ url: '/admin/users', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'User', id: 'LIST' }, ...AFTER_WRITE, 'MessageLog'],
    }),
    updateUser: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [...userTags(id), { type: 'Session', id }],
    }),
    toggleUser: build.mutation({
      query: (id) => ({ url: `/admin/users/${id}/toggle`, method: 'PATCH' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, id) => [...userTags(id), { type: 'Session', id }],
    }),
    deleteUser: build.mutation({
      query: (id) => ({ url: `/admin/users/${id}`, method: 'DELETE' }),
      invalidatesTags: (r, e, id) => userTags(id),
    }),
    /** The normal reset link, by email. The answer is `{ sent, email }` — never a token. */
    sendPasswordReset: build.mutation({
      query: (id) => ({ url: `/admin/users/${id}/send-password-reset`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: [...AFTER_WRITE, 'MessageLog'],
    }),
    unlockUser: build.mutation({
      query: (id) => ({ url: `/admin/users/${id}/unlock`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, id) => userTags(id),
    }),
    getUserSessions: build.query({
      query: (id) => `/admin/users/${id}/sessions`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Session', id }],
      keepUnusedDataFor: 0,
    }),
    revokeUserSessions: build.mutation({
      query: (id) => ({ url: `/admin/users/${id}/sessions`, method: 'DELETE' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, id) => [{ type: 'Session', id }, ...AFTER_WRITE],
    }),
  }),
});

export const {
  useGetUsersQuery, useGetUserQuery, useCreateUserMutation, useUpdateUserMutation, useToggleUserMutation,
  useDeleteUserMutation, useSendPasswordResetMutation, useUnlockUserMutation, useGetUserSessionsQuery,
  useRevokeUserSessionsMutation,
} = usersApi;
