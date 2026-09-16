import { apiSlice } from '@/api/apiSlice';

/**
 * A record's History tab: `GET <endpoint>?page&limit` (`/admin/leads/:id/history`,
 * `/admin/customers/:id/history`). One query for every record type, so a later detail
 * page adds a tab, not an endpoint. Tagged `History`: any write that lands in a record's
 * audit trail invalidates it.
 */
export const historyApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getRecordHistory: build.query({
      query: ({ endpoint, page = 1, limit = 20 }) => ({ url: endpoint, params: { page, limit } }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['History'],
    }),
  }),
});

export const { useGetRecordHistoryQuery } = historyApi;
