import { apiSlice } from '@/api/apiSlice';

/**
 * The whole audit log and the sign-in trail (ADMIN). A record's own History tab reads
 * `historyApi` instead, which other roles may use.
 */
export const auditApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getAuditLogs: build.query({
      query: (params = {}) => ({ url: '/admin/audit-logs', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['AuditLog'],
    }),
    /** The models the log has rows for — the model filter's options. */
    getAuditModels: build.query({
      query: () => '/admin/audit-logs/models',
      transformResponse: (r) => r.data,
      providesTags: ['AuditLog'],
    }),
    getLoginActivity: build.query({
      query: (params = {}) => ({ url: '/admin/login-activity', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['LoginActivity'],
    }),
    getLoginSummary: build.query({
      query: (params = {}) => ({ url: '/admin/login-activity/summary', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['LoginActivity', { type: 'User', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetAuditLogsQuery, useGetAuditModelsQuery, useGetLoginActivityQuery, useGetLoginSummaryQuery,
} = auditApi;
