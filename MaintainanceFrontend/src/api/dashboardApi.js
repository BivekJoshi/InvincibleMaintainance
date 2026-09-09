import { apiSlice } from '@/app/api/apiSlice';

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
    markAllRead: build.mutation({
      query: () => ({ url: '/admin/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetDashboardQuery, useGetNotificationsQuery,
  useMarkNotificationReadMutation, useMarkAllReadMutation,
} = dashboardApi;
