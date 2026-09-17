import { apiSlice } from '@/api/apiSlice';

/**
 * Site settings, for the settings screen. The public site reads the same values through
 * `/public/bootstrap`, so a save also invalidates `Public` — the header shows a new phone
 * number in the same tab.
 */
export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    /** `{ [group]: Setting[] }`, each group in its own order. Needs `settings:read`. */
    getSettings: build.query({
      query: () => '/admin/settings',
      transformResponse: (r) => r.data,
      providesTags: ['Setting'],
    }),
    /** `values` holds only the keys that changed. ADMIN only; answers the flat key → value map. */
    updateSettings: build.mutation({
      query: (values) => ({ url: '/admin/settings', method: 'PATCH', body: { values } }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Setting', 'Public'],
    }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi;
