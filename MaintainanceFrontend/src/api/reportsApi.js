import { apiSlice } from '@/api/apiSlice';

/**
 * The sales reports (`reports:sales`). Phase L1 has one, the lost-lead report; Phase I10 folds it
 * into `/admin/reports`.
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
