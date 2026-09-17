import { apiSlice } from '@/api/apiSlice';

/**
 * Stock (Phase H1): derived balances, movements, and "Record movement". The materials
 * themselves are a registry entry (`cmsApi`), whose writes also invalidate `Stock`
 * (`ALSO_READ_AS` there). Issuing to a job lives in `jobsApi`.
 */
export const stockApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getStock: build.query({
      query: (params = {}) => ({ url: '/admin/stock', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['Stock'],
    }),
    getStockMovements: build.query({
      query: (params = {}) => ({ url: '/admin/stock/movements', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['Stock'],
    }),
    /** PURCHASE, RETURN, ADJUSTMENT or WASTAGE. `rate` is in rupees. */
    recordStockMovement: build.mutation({
      query: (body) => ({ url: '/admin/stock/movements', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Stock', 'Dashboard', 'Notification'],
    }),
  }),
});

export const { useGetStockQuery, useGetStockMovementsQuery, useRecordStockMovementMutation } = stockApi;
