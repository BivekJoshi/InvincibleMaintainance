import { apiSlice } from '@/api/apiSlice';

/**
 * The lost-lead report (`reports:sales`, Phase L1) — since Phase I10 the Lost leads tab of Reports › Sales reports
 * (`pages/admin/ReportsPage/sections/LostReport`). The other reports and every CSV are in `financeApi.js`.
 */
export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // { total, byCategory: [{ category, count }], rows: [{ category, stage, serviceId, serviceName, count }] }
    getLostReport: build.query({
      query: ({ from, to } = {}) => ({ url: '/admin/reports/lost', params: { from, to } }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Report', id: 'lost' }, { type: 'Lead', id: 'LIST' }],
    }),
  }),
});

export const { useGetLostReportQuery } = reportsApi;
