import { apiSlice } from '@/api/apiSlice';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query({
      query: () => '/admin/dashboard',
      transformResponse: (r) => r.data,
      providesTags: ['Dashboard'],
    }),
    getNotifications: build.query({
      query: (params = {}) => ({ url: '/admin/notifications', params }),
      transformResponse: (r) => ({ items: r.data, unread: r.meta?.unread ?? 0 }),
      providesTags: ['Notification'],
    }),
    markNotificationRead: build.mutation({
      query: (id) => ({ url: `/admin/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    // The SLA board's nav badge. Here rather than in leadsApi because the shell loads this
    // file; only the count is read (limit 1).
    getBreachedLeadCount: build.query({
      query: () => ({ url: '/admin/leads', params: { slaRisk: 'breached', limit: 1 } }),
      transformResponse: (r) => r.meta?.total ?? 0,
      providesTags: [{ type: 'Lead', id: 'LIST' }, 'LeadBoard'],
    }),
    markAllRead: build.mutation({
      query: () => ({ url: '/admin/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetDashboardQuery, useGetNotificationsQuery,
  useMarkNotificationReadMutation, useMarkAllReadMutation, useGetBreachedLeadCountQuery,
} = dashboardApi;
