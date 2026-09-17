import { apiSlice, listAndItem, tagList } from '@/api/apiSlice';

/**
 * The quotation screens' endpoints: the list and its stage queues, the builder, and the
 * approval moves (Phase F).
 *
 * Rates travel in RUPEES, which is what the API's zod schema accepts; the server
 * converts to paisa and is the only thing that computes totals.
 *
 * Every move invalidates the quotation, the list, the dashboard counts, the History tab
 * and the notification badge (an approval or send-back notifies someone, possibly the
 * signed-in user).
 */
const MOVE_TAGS = (result, error, arg) => [
  { type: 'Quotation', id: 'LIST' },
  { type: 'Quotation', id: typeof arg === 'string' ? arg : arg?.id },
  'Dashboard', 'History', 'Notification',
];

const move = (build, segment) => build.mutation({
  query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}/${segment}`, method: 'POST', body }),
  transformResponse: (r) => r.data,
  invalidatesTags: MOVE_TAGS,
});

export const quotationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    /** `{ stage?, status?, customerId?, q, page, limit, sort }` — `stage` is one of the API's queues. */
    getQuotations: build.query({
      query: (params = {}) => ({ url: '/admin/quotations', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Quotation'),
    }),
    /** How many quotations a stage holds — a tab's count (limit 1, only the total is read). */
    getQuotationStageCount: build.query({
      query: (stage) => ({ url: '/admin/quotations', params: { stage, limit: 1 } }),
      transformResponse: (r) => r.meta?.total ?? 0,
      providesTags: [{ type: 'Quotation', id: 'LIST' }],
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
      invalidatesTags: (result, error, arg) => [...listAndItem('Quotation')(result, error, arg), 'History'],
    }),
    submitQuotation: move(build, 'submit'),
    /** `{ id, note? }` */
    approveQuotation: move(build, 'approve'),
    /** `{ id, note }` */
    sendBackQuotation: move(build, 'send-back'),
    /** `{ id, note }` */
    pullBackQuotation: move(build, 'pull-back'),
    sendQuotation: move(build, 'send'),
    /** A new DRAFT version; the answer is that version. */
    reviseQuotation: move(build, 'revise'),
    /** Quotations the customer approved before Phase F only — acceptance now creates the job itself. */
    convertQuotationToJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}/convert-to-job`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [...MOVE_TAGS(result, error, arg), { type: 'Job', id: 'LIST' }],
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
  useGetQuotationStageCountQuery,
  useGetQuotationQuery,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useSubmitQuotationMutation,
  useApproveQuotationMutation,
  useSendBackQuotationMutation,
  usePullBackQuotationMutation,
  useSendQuotationMutation,
  useReviseQuotationMutation,
  useConvertQuotationToJobMutation,
  useDeleteQuotationMutation,
  useGetRateCardQuery,
} = quotationsApi;
