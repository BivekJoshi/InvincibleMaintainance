import { apiSlice, listAndItem, tagList } from '@/api/apiSlice';

/**
 * Every endpoint here maps to a route that already existed — the quotation
 * backend has simply never been called from the browser.
 *
 * Rates travel in RUPEES, which is what the API's zod schema accepts; the server
 * converts to paisa and is the only thing that computes totals.
 */
export const quotationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getQuotations: build.query({
      query: (params = {}) => ({ url: '/admin/quotations', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Quotation'),
    }),
    getQuotation: build.query({
      query: (id) => `/admin/quotations/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Quotation', id }],
    }),
    createQuotation: build.mutation({
      query: (body) => ({ url: '/admin/quotations', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Quotation', id: 'LIST' }, 'Dashboard'],
    }),
    updateQuotation: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndItem('Quotation'),
    }),
    sendQuotation: build.mutation({
      query: (id) => ({ url: `/admin/quotations/${id}/send`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndItem('Quotation'),
    }),
    reviseQuotation: build.mutation({
      query: (id) => ({ url: `/admin/quotations/${id}/revise`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Quotation', id: 'LIST' }],
    }),
    deleteQuotation: build.mutation({
      query: (id) => ({ url: `/admin/quotations/${id}`, method: 'DELETE' }),
      invalidatesTags: listAndItem('Quotation'),
    }),
    getRateCard: build.query({
      query: (params = {}) => ({ url: '/admin/rate-card', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('RateCard'),
    }),
  }),
});

export const {
  useGetQuotationsQuery,
  useGetQuotationQuery,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useSendQuotationMutation,
  useReviseQuotationMutation,
  useDeleteQuotationMutation,
  useGetRateCardQuery,
} = quotationsApi;
