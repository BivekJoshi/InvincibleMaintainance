import { apiSlice, listAndItem, tagList } from '@/api/apiSlice';
import { arrayBufferToBase64 } from '@/helpers/download';

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
    /**
     * `{ stage?, status?, customerId?, kind?, jobId?, q, page, limit, sort }` — `stage` is one of the API's queues; `kind`
     * QUOTATION or VARIATION and `jobId` a job's variations (Phase L7). A row carries `kind`, `jobId` and `job`.
     */
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
    /**
     * `{ customerId, siteId?, leadId?, items? }` — a draft; since Phase L3 it may start with no rows. Phase L7: `{ jobId,
     * items }` starts a VARIATION of that job instead (VO-, the job's customer and site, negative rows allowed).
     */
    createQuotation: build.mutation({
      query: (body) => ({ url: '/admin/quotations', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { leadId } = {}) => [
        { type: 'Quotation', id: 'LIST' }, 'Dashboard',
        ...(leadId ? [{ type: 'Lead', id: leadId }, { type: 'Lead', id: 'LIST' }] : []),
      ],
    }),
    updateQuotation: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [...listAndItem('Quotation')(result, error, arg), 'History'],
    }),
    submitQuotation: move(build, 'submit'),
    /**
     * `{ id, note?, acknowledgeLowMargin? }` — below `quotation.minMarginPct`, or with a cost unknown, the API
     * answers 422 `LOW_MARGIN` (`details: { marginPct, minMarginPct, costComplete }`) until the approver
     * acknowledges it (Phase L4).
     */
    approveQuotation: move(build, 'approve'),
    /** `{ id, note }` */
    sendBackQuotation: move(build, 'send-back'),
    /** `{ id, note }` */
    pullBackQuotation: move(build, 'pull-back'),
    sendQuotation: move(build, 'send'),
    /** A new DRAFT version; the answer is that version. */
    reviseQuotation: move(build, 'revise'),
    /**
     * The staff way to win the work (the customer said yes by phone) — acceptance on the link creates the job itself.
     * Since Phase L6 it runs the same hand-off: the job with its lines and plan, the lead WON, and the advance invoice
     * when the schedule has an ON_ACCEPT stage. Answers the job detail (with `advance`).
     */
    convertQuotationToJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}/convert-to-job`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      // A variation (Phase L7) answers the job it joined — its lines, plan and progress change.
      invalidatesTags: (result, error, arg) => [
        ...MOVE_TAGS(result, error, arg), { type: 'Job', id: 'LIST' }, 'Dispatch', { type: 'Invoice', id: 'LIST' },
        ...(result?.id ? [{ type: 'Job', id: result.id }, { type: 'Job', id: `plan:${result.id}` }, { type: 'Job', id: `progress:${result.id}` }] : []),
      ],
    }),
    deleteQuotation: build.mutation({
      query: (id) => ({ url: `/admin/quotations/${id}`, method: 'DELETE' }),
      invalidatesTags: listAndItem('Quotation'),
    }),
    /**
     * `POST /admin/quotations/preview` (Phase L3) — unsaved rows through the same server code as a save:
     * `{ quotationId?, items, discount? | discountPct? | targetTotal?, vatApplied }` (rupees) →
     * `{ items: [{ index, number, netQty, qty, amount, recipe, … }], totals, cost? }` (paisa). A query although
     * it is a POST, like `deriveRateCost`: the builder asks again as the rows change, and the same rows are
     * answered from the cache. The builder's live totals, amounts and margin, and the discount helpers.
     */
    previewQuotation: build.query({
      query: (body) => ({ url: '/admin/quotations/preview', method: 'POST', body }),
      transformResponse: (r) => r.data,
      keepUnusedDataFor: 30,
    }),
    /**
     * `GET /admin/quotations/:id/takeoff` — what the saved rows need: materials in buying units with stock on
     * hand and the shortfall, labour days per trade, other items, and the rows without a recipe. Cost only for
     * `costs:read` (the API strips it). Tagged with the quotation, so a save refreshes it.
     */
    getQuotationTakeoff: build.query({
      query: (id) => `/admin/quotations/${id}/takeoff`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Quotation', id }],
    }),
    /**
     * `POST /admin/quotations/:id/reprice { apply }` — a DRAFT's rows re-priced from the rate library today:
     * `apply: false` lists what would change and writes nothing; `apply: true` re-snapshots the recipes and
     * rates and answers the quotation.
     */
    repriceQuotation: build.mutation({
      query: ({ id, apply }) => ({ url: `/admin/quotations/${id}/reprice`, method: 'POST', body: { apply } }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id, apply }) => (apply && !error
        ? [{ type: 'Quotation', id }, { type: 'Quotation', id: 'LIST' }, 'History']
        : []),
    }),
    /** `POST /admin/quotations/:id/copy { customerId?, siteId?, leadId? }` → a new DRAFT with the same rows and terms. */
    copyQuotation: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/quotations/${id}/copy`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { leadId }) => [
        { type: 'Quotation', id: 'LIST' }, 'Dashboard',
        ...(leadId ? [{ type: 'Lead', id: leadId }, { type: 'Lead', id: 'LIST' }] : []),
      ],
    }),
    /**
     * `GET /admin/quotations/:id/export.xlsx` (Phase L4) — the quotation as an Excel workbook: the BOQ with live
     * formulas, the measurements and the payment schedule, and a Cost sheet only for `costs:read`. The download
     * pattern of `exportLeadsCsv` (a lazy query, nothing kept), but binary: the answer is cached as base64 text,
     * because the store holds only serialisable values — `helpers/download#downloadBase64` makes the file. An
     * error answer is the API's JSON envelope. The API audits every export (`export.xlsx`).
     */
    exportQuotationXlsx: build.query({
      query: (id) => ({
        url: `/admin/quotations/${id}/export.xlsx`,
        responseHandler: async (res) => (res.ok ? arrayBufferToBase64(await res.arrayBuffer()) : res.json().catch(() => null)),
      }),
      keepUnusedDataFor: 0,
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
  usePreviewQuotationQuery,
  useLazyPreviewQuotationQuery,
  useGetQuotationTakeoffQuery,
  useRepriceQuotationMutation,
  useCopyQuotationMutation,
  useLazyExportQuotationXlsxQuery,
} = quotationsApi;
