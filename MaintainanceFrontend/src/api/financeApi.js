import { apiSlice, tagList } from '@/api/apiSlice';

/**
 * Finance (Phase I): invoices, payments, the finance reports, the sales and operations
 * reports of `/admin/reports`, and every report's CSV download. Money in answers is integer paisa; money in request
 * bodies is rupees. An invoice's status, totals, VAT and `balance` are the server's — nothing here computes one.
 *
 * Tags: an invoice is `{ type: 'Invoice', id }`, the list `{ type: 'Invoice', id: 'LIST' }`; payments
 * `{ type: 'Payment', id: 'LIST' }`; every report `Report`. A write that moves money invalidates the invoice, both
 * lists, the reports, the customer (their statement and balance), History and the dashboard.
 *
 * Phase L8 — close-out: `raiseStageInvoice` (a RUNNING bill for a MILESTONE stage of the job's payment schedule) and
 * `getFinalBill` (the FINAL bill's preview — the server's lines, deductions, totals and what blocks it). The preview is
 * tagged `{ type: 'Job', id: 'final-bill:<jobId>' }`: money moving (every write here invalidates `Job`) and the final
 * measurement (`jobsApi`) refresh it.
 *
 * Expenses are a registry entry (`cmsApi` with `resource: 'expenses'`); their category suggestions come through
 * `lookupApi#getSuggestions`.
 */

const invoiceTag = (id) => ({ type: 'Invoice', id });
/**
 * Since Phase L6 a payment can lift a job's advance gate (and voiding one can put it back), so money moving also
 * refreshes the jobs — their "Awaiting advance" chip, the job page's advance card, the Plan tab — and the board.
 */
const MONEY_MOVED = [
  { type: 'Invoice', id: 'LIST' }, { type: 'Payment', id: 'LIST' }, 'Report', 'Customer', 'History', 'Dashboard',
  'Job', 'Dispatch',
];
const listOf = (r) => ({ items: r.data, meta: r.meta });
const dataOf = (r) => r.data;

/** A report's query: its path and the page's filters (`from`, `to`, `groupBy`). */
const report = (build, path) => build.query({
  query: (params = {}) => ({ url: path, params }),
  transformResponse: dataOf,
  providesTags: ['Report'],
});

export const financeApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // ── invoices
    /** `?status&kind&customerId&overdueOnly&from&to&q&page&limit&sort`; `meta.counts` feeds the status tabs. */
    getInvoices: build.query({
      query: (params = {}) => ({ url: '/admin/invoices', params }),
      transformResponse: listOf,
      providesTags: tagList('Invoice'),
    }),
    /** The invoice with `balance`, `publicUrl` (once sent), `jobs` and its payments (voided ones marked). */
    getInvoice: build.query({
      query: (id) => `/admin/invoices/${id}`,
      transformResponse: dataOf,
      providesTags: (result, error, id) => [invoiceTag(id)],
    }),
    /** The manual invoice: `{ customerId, items: [{ description, unit?, qty, rate (rupees) }], discount, vatApplied, dueDate, note, terms }`. */
    createInvoice: build.mutation({
      query: (body) => ({ url: '/admin/invoices', method: 'POST', body }),
      transformResponse: dataOf,
      invalidatesTags: MONEY_MOVED,
    }),
    /** `{ jobId, dueDate?, includeMaterials?, includeLabour?, vatApplied?, discount? }` → 201 the invoice. */
    createInvoiceFromJob: build.mutation({
      query: ({ jobId, ...body }) => ({ url: `/admin/invoices/from-job/${jobId}`, method: 'POST', body }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { jobId }) => [...MONEY_MOVED, { type: 'Job', id: 'LIST' }, { type: 'Job', id: jobId }, 'Dispatch'],
    }),
    /**
     * `POST /admin/jobs/:id/invoices/stage { paymentStageId }` (Phase L8, `invoices:write`) → 201 a RUNNING invoice, a
     * DRAFT with locked lines, for the stage's amount of the payment schedule. 404 STAGE_NOT_FOUND, 422
     * STAGE_NOT_MILESTONE, 409 STAGE_BILLED, 422 FINAL_ALREADY_BILLED.
     */
    raiseStageInvoice: build.mutation({
      query: ({ jobId, paymentStageId }) => ({ url: `/admin/jobs/${jobId}/invoices/stage`, method: 'POST', body: { paymentStageId } }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { jobId }) => [...MONEY_MOVED, { type: 'Job', id: jobId }],
    }),
    /**
     * `GET /admin/jobs/:id/final-bill` (Phase L8, `invoices:read`) — the FINAL bill as `POST …/from-job/:jobId` would
     * raise it: `{ boq: true, contractType, measurementRequired, measurementClosed, lines, deductions, totals: { contract,
     * billed, due }, blocking }`, or `{ boq: false }` for a job without BOQ lines (Phase I's rules bill it).
     */
    getFinalBill: build.query({
      query: (jobId) => `/admin/jobs/${jobId}/final-bill`,
      transformResponse: dataOf,
      providesTags: (r, e, jobId) => [{ type: 'Job', id: `final-bill:${jobId}` }, { type: 'Job', id: jobId }],
      keepUnusedDataFor: 0,
    }),
    /** A DRAFT only; anything else is 422 INVOICE_LOCKED. */
    updateInvoice: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/invoices/${id}`, method: 'PUT', body }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { id }) => [invoiceTag(id), ...MONEY_MOVED],
    }),
    sendInvoice: build.mutation({
      query: (id) => ({ url: `/admin/invoices/${id}/send`, method: 'POST' }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, id) => [invoiceTag(id), ...MONEY_MOVED],
    }),
    voidInvoice: build.mutation({
      query: ({ id, reason }) => ({ url: `/admin/invoices/${id}/void`, method: 'POST', body: { reason } }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { id }) => [invoiceTag(id), ...MONEY_MOVED],
    }),
    /** `{ id, amount (rupees, ≤ balance), method, reference?, receivedAt?, note? }` */
    recordPayment: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/invoices/${id}/payments`, method: 'POST', body }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { id }) => [invoiceTag(id), ...MONEY_MOVED],
    }),
    voidPayment: build.mutation({
      query: ({ id, paymentId, reason }) => ({ url: `/admin/invoices/${id}/payments/${paymentId}/void`, method: 'POST', body: { reason } }),
      transformResponse: dataOf,
      invalidatesTags: (r, e, { id }) => [invoiceTag(id), ...MONEY_MOVED],
    }),

    // ── payments
    /** `?q&method&customerId&from&to&page&limit&sort`; `meta.totals` is `{ total, count, byMethod }` over the non-voided. */
    getPayments: build.query({
      query: (params = {}) => ({ url: '/admin/payments', params }),
      transformResponse: listOf,
      providesTags: [{ type: 'Payment', id: 'LIST' }],
    }),

    // ── finance reports (reports:finance)
    getAgingReport: report(build, '/admin/reports/aging'),
    getRevenueReport: report(build, '/admin/reports/revenue'),
    getCollectionsReport: report(build, '/admin/reports/collections'),

    // ── sales and operations reports (/admin/reports)
    getLeadSourceReport: report(build, '/admin/reports/lead-sources'),
    getFunnelReport: report(build, '/admin/reports/funnel'),
    getSlaReport: report(build, '/admin/reports/sla'),
    getTechnicianReport: report(build, '/admin/reports/technicians'),
    getWarrantyClaimReport: report(build, '/admin/reports/warranty-claims'),
    getJobMarginReport: report(build, '/admin/reports/job-margin'),

    /**
     * Any report as CSV (`?format=csv` with the page's filters). Through baseQuery, so it carries the Bearer token
     * and survives a 401 → refresh → retry. The answer is kept as `{ csv, truncated, fileName }` — text, because
     * the cache holds only serialisable values; `res.text()` drops the BOM, which the page puts back. An error
     * answer stays the API's JSON.
     */
    downloadReportCsv: build.query({
      query: ({ path, params = {} }) => ({
        url: path,
        params: { ...params, format: 'csv' },
        responseHandler: async (res) => (res.ok
          ? {
            csv: await res.text(),
            truncated: res.headers.get('X-Export-Truncated') === 'true',
            disposition: res.headers.get('Content-Disposition'),
          }
          : res.json().catch(() => null)),
      }),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetInvoicesQuery, useGetInvoiceQuery, useCreateInvoiceMutation, useCreateInvoiceFromJobMutation,
  useRaiseStageInvoiceMutation, useGetFinalBillQuery,
  useUpdateInvoiceMutation, useSendInvoiceMutation, useVoidInvoiceMutation, useRecordPaymentMutation,
  useVoidPaymentMutation, useGetPaymentsQuery,
  useGetAgingReportQuery, useGetRevenueReportQuery, useGetCollectionsReportQuery,
  useGetLeadSourceReportQuery, useGetFunnelReportQuery, useGetSlaReportQuery, useGetTechnicianReportQuery,
  useGetWarrantyClaimReportQuery, useGetJobMarginReportQuery, useLazyDownloadReportCsvQuery,
} = financeApi;
