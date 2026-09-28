import { apiSlice, tagList } from '@/api/apiSlice';

/**
 * Jobs, their parts (checklist, photos, materials, time), the dispatch board and the
 * unassigned queue (Phase H1).
 *
 * Tags: a job is `{ type: 'Job', id }`, the lists `{ type: 'Job', id: 'LIST' }`, the board
 * and the queue `Dispatch`. Anything that changes a job's status, window or people also
 * invalidates `Dispatch`, `Dashboard` and `History`. Issuing or reversing material changes
 * stock (`Stock`), and every part that costs money changes the costing (`{ type: 'Job',
 * id: 'costing:<id>' }`).
 *
 * Phase L6: the Plan tab's `getJobPlan` (`{ type: 'Job', id: 'plan:<id>' }` — refreshed by every move, since the crew,
 * the window and the advance are on it) and `overrideJobAdvance`. Recording or voiding a payment (`financeApi`)
 * invalidates `Job` and `Dispatch` too, because the advance gate follows the advance invoice.
 *
 * Phase L7 — the job on site: `getJobProgress` (BOQ & progress, `progress:<id>`), `getJobPlannedVsActual` (Materials /
 * Labour, `pva:<id>`), `getJobDiary` (the site diary, `diary:<id>`) and `getJobVariations` (`variations:<id>`); each is
 * also tagged with the job, so whatever refreshes the job refreshes them. `createShortfallPurchaseList` raises a DRAFT
 * purchase list from the job's shortfall. Issuing material answers `{ line, warnings }` — `OVER_PLAN` when the job's
 * issued total passes its plan (a warning; the issue still happened).
 *
 * Phase L8 — close-out: `measureJobLine` (the final measurement of one line — its rows; the quantity is the server's),
 * `closeJobMeasurement` / `reopenJobMeasurement`, and `offerAmc` (a lead for sales at handover). Each refreshes the job,
 * its BOQ & progress tab and the final bill's preview (`{ type: 'Job', id: 'final-bill:<id>' }`, read by
 * `financeApi#getFinalBill`).
 */

const jobTag = (id) => ({ type: 'Job', id });
const costingTag = (id) => ({ type: 'Job', id: `costing:${id}` });
const planTag = (id) => ({ type: 'Job', id: `plan:${id}` });
const progressTag = (id) => ({ type: 'Job', id: `progress:${id}` });
const pvaTag = (id) => ({ type: 'Job', id: `pva:${id}` });
const diaryTag = (id) => ({ type: 'Job', id: `diary:${id}` });
const variationsTag = (id) => ({ type: 'Job', id: `variations:${id}` });
/** The final bill's preview (Phase L8) — `financeApi#getFinalBill` provides it; a measurement change refreshes it. */
export const finalBillTag = (id) => ({ type: 'Job', id: `final-bill:${id}` });
/** The purchase-list registry's list (`cmsApi` tags a registry resource `{ type: 'Cms', id: resource }`). */
const PURCHASE_LISTS = { type: 'Cms', id: 'purchase-lists' };
const LIST = { type: 'Job', id: 'LIST' };

/** A move of status, window or people. */
const moveTags = (result, error, { id }) => [
  jobTag(id), LIST, costingTag(id), planTag(id), 'Dispatch', 'Dashboard', 'History', 'Notification',
  { type: 'Job', id: 'TECH_TODAY' },
];
/** A change to one of the job's parts. */
const partTags = (result, error, { id }) => [jobTag(id), 'History'];
const costTags = (result, error, { id }) => [jobTag(id), costingTag(id), 'History'];

export const jobsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getJobs: build.query({
      query: (params = {}) => ({ url: '/admin/jobs', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Job'),
    }),
    getJob: build.query({
      query: (id) => `/admin/jobs/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [jobTag(id)],
    }),
    createJob: build.mutation({
      query: (body) => ({ url: '/admin/jobs', method: 'POST', body }),
      transformResponse: (r) => r.data,
      // From a quotation it runs the hand-off (Phase L6), which may raise the advance invoice.
      invalidatesTags: [LIST, 'Dispatch', 'Dashboard', { type: 'Quotation', id: 'LIST' }, { type: 'Invoice', id: 'LIST' }],
    }),
    /** Details only — never the status. */
    updateJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),
    deleteJob: build.mutation({
      query: (id) => ({ url: `/admin/jobs/${id}`, method: 'DELETE' }),
      invalidatesTags: [LIST, 'Dispatch', 'Dashboard'],
    }),
    setJobStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/status`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),
    /**
     * The board's drop and the Schedule dialog. Answers `{ job, warnings }` — the warnings the
     * API found once the move was made (the board shows its own before it sends).
     */
    scheduleJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/schedule`, method: 'POST', body }),
      transformResponse: (r) => ({ job: r.data, warnings: r.meta?.warnings ?? [] }),
      invalidatesTags: moveTags,
    }),
    assignJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/assign`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),
    completeJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/complete`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),
    verifyJob: build.mutation({
      query: ({ id }) => ({ url: `/admin/jobs/${id}/verify`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),

    addJobTask: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/tasks`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: partTags,
    }),
    /** Optimistic: a tick shows at once. */
    updateJobTask: build.mutation({
      query: ({ id, taskId, ...body }) => ({ url: `/admin/jobs/${id}/tasks/${taskId}`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      async onQueryStarted({ id, taskId, ...body }, { dispatch, queryFulfilled }) {
        const patch = dispatch(jobsApi.util.updateQueryData('getJob', id, (draft) => {
          const task = draft?.tasks?.find((t) => t.id === taskId);
          if (task) Object.assign(task, body);
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: partTags,
    }),
    deleteJobTask: build.mutation({
      query: ({ id, taskId }) => ({ url: `/admin/jobs/${id}/tasks/${taskId}`, method: 'DELETE' }),
      invalidatesTags: partTags,
    }),
    addJobPhoto: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/photos`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: partTags,
    }),
    deleteJobPhoto: build.mutation({
      query: ({ id, photoId }) => ({ url: `/admin/jobs/${id}/photos/${photoId}`, method: 'DELETE' }),
      invalidatesTags: partTags,
    }),
    /**
     * Answers `{ line, warnings }` — the issued line, and `meta.warnings` (Phase L7: `[{ code: 'OVER_PLAN', materialId,
     * name, unit, planned, issued }]` when the job's issued total for that material passes its plan, or it is not planned
     * on a job that has a plan). A warning never blocks: the stock has already moved.
     */
    issueJobMaterial: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/materials`, method: 'POST', body }),
      transformResponse: (r) => ({ line: r.data, warnings: r.meta?.warnings ?? [] }),
      invalidatesTags: (result, error, arg) => [...costTags(result, error, arg), pvaTag(arg.id), planTag(arg.id), 'Stock', 'Dashboard'],
    }),
    reverseJobMaterial: build.mutation({
      query: ({ id, jobMaterialId }) => ({ url: `/admin/jobs/${id}/materials/${jobMaterialId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, arg) => [...costTags(result, error, arg), pvaTag(arg.id), planTag(arg.id), 'Stock', 'Dashboard'],
    }),
    addJobTimeLog: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/time-logs`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: costTags,
    }),
    deleteJobTimeLog: build.mutation({
      query: ({ id, logId }) => ({ url: `/admin/jobs/${id}/time-logs/${logId}`, method: 'DELETE' }),
      invalidatesTags: costTags,
    }),
    /**
     * The Plan tab (Phase L6, `jobs:read`): quantities only — `{ job, advance, sections, lineCount, materials,
     * labour, labourDays, crew, readiness }`. A job with no lines is not a BOQ job (`lineCount: 0`).
     */
    getJobPlan: build.query({
      query: (id) => `/admin/jobs/${id}/plan`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [planTag(id)],
    }),
    /**
     * `POST /admin/jobs/:id/advance-override { reason }` (`jobs:advance-override`: MANAGER, ADMIN) — the job may be
     * scheduled before its advance is paid. Answers the job detail; 422 when no advance is required, it is paid or
     * already overridden.
     */
    overrideJobAdvance: build.mutation({
      query: ({ id, reason }) => ({ url: `/admin/jobs/${id}/advance-override`, method: 'POST', body: { reason } }),
      transformResponse: (r) => r.data,
      invalidatesTags: moveTags,
    }),
    /**
     * The BOQ & progress tab (Phase L7, `jobs:read`): `{ sections: [{ title, lines: [{ id, number, source, description,
     * unit, quotedQty, progressPct, isProvisional, rate?, value?, earned? }] }], totals: { value?, earned?, earnedPct },
     * stages: [{ id, label, basisPoints, trigger, cumulativeBp, billed, due }], nextBill }`. Money (`rate`, `value`,
     * `earned`) only for `quotations:read` / `invoices:read` holders — the API leaves it out for anyone else.
     */
    getJobProgress: build.query({
      query: (id) => `/admin/jobs/${id}/progress`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [progressTag(id), jobTag(id)],
    }),
    /**
     * The Materials / Labour tab (Phase L7, `jobs:read`), quantities only: `{ materials: [{ materialId, code, name, unit,
     * planned, issued, received, variance, overPlan }], labour: [{ tradeId, code, name, plannedDays, loggedDays }],
     * technicianHours, workdayHours }`.
     */
    getJobPlannedVsActual: build.query({
      query: (id) => `/admin/jobs/${id}/planned-vs-actual`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [pvaTag(id), jobTag(id)],
    }),
    /** The site diary in the office (Phase L7, `jobs:read`): `{ days: [Diary + media] }`, newest first. No money. */
    getJobDiary: build.query({
      query: (id) => `/admin/jobs/${id}/diary`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [diaryTag(id), jobTag(id)],
    }),
    /**
     * The job's variation orders (Phase L7, `jobs:read`): `[{ id, number, version, status, total?, kind, createdAt, sentAt,
     * decidedAt }]` — `total` only for `quotations:read` holders. Refreshed by any quotation move.
     */
    getJobVariations: build.query({
      query: (id) => `/admin/jobs/${id}/variations`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [variationsTag(id), jobTag(id), { type: 'Quotation', id: 'LIST' }],
    }),
    /**
     * `POST /admin/jobs/:id/purchase-lists/from-shortfall` (`materials:write`) → 201 a DRAFT purchase list prefilled with
     * each planned material's shortfall (in packs where it has a pack size); 422 `NO_SHORTFALL` when nothing is short.
     */
    createShortfallPurchaseList: build.mutation({
      query: ({ id }) => ({ url: `/admin/jobs/${id}/purchase-lists/from-shortfall`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [PURCHASE_LISTS, pvaTag(id), 'History'],
    }),
    /**
     * `PUT /admin/jobs/:id/lines/:lineId/measure { measurements }` (Phase L8, `jobs:write`) — the line's final measurement
     * rows (1–200). Answers the line, quantities only: `{ id, number, section, source, description, unit, quotedQty,
     * isProvisional, measurements, measuredQty }` — `measuredQty` is the server's. 422 MEASUREMENT_CLOSED, 422
     * LINE_NOT_MEASURED (an omission), 404 for a line not on the job.
     */
    measureJobLine: build.mutation({
      query: ({ id, lineId, measurements }) => ({ url: `/admin/jobs/${id}/lines/${lineId}/measure`, method: 'PUT', body: { measurements } }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [jobTag(id), progressTag(id), finalBillTag(id), 'History'],
    }),
    /**
     * `POST /admin/jobs/:id/measurement/close` (Phase L8, `jobs:write`) → the job detail with `measurementClosedAt` and
     * `measurementClosedBy`. 422 MEASUREMENT_INCOMPLETE with `details: [{ lineId, number, description }]` — the lines
     * the contract measures that have no quantity yet.
     */
    closeJobMeasurement: build.mutation({
      query: ({ id }) => ({ url: `/admin/jobs/${id}/measurement/close`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [jobTag(id), progressTag(id), finalBillTag(id), 'History'],
    }),
    /** `POST …/measurement/reopen` (Phase L8, `jobs:write`) → the job; 422 FINAL_ALREADY_BILLED once a final bill exists. */
    reopenJobMeasurement: build.mutation({
      query: ({ id }) => ({ url: `/admin/jobs/${id}/measurement/reopen`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [jobTag(id), progressTag(id), finalBillTag(id), 'History'],
    }),
    /**
     * `POST /admin/jobs/:id/offer-amc` (Phase L8, `jobs:write`) — a lead for sales to offer a maintenance contract
     * (`source: 'amc_offer'`), linked to the customer and the site. 201 a new lead; **200** the customer's open AMC-offer
     * lead instead of a second one — answered here as `{ lead, existing }`.
     */
    offerAmc: build.mutation({
      query: ({ id }) => ({ url: `/admin/jobs/${id}/offer-amc`, method: 'POST' }),
      transformResponse: (r, meta) => ({ lead: r.data, existing: meta?.response?.status === 200 }),
      invalidatesTags: (result, error, { id }) => [jobTag(id), { type: 'Lead', id: 'LIST' }, 'LeadBoard', 'Dashboard', 'History'],
    }),
    getJobCosting: build.query({
      query: (id) => `/admin/jobs/${id}/costing`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [costingTag(id)],
    }),
    /** Creates the unpublished case study; the caller opens it in the project editor. */
    publishCaseStudy: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/publish-case-study`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [jobTag(id), { type: 'Cms', id: 'projects' }, 'History'],
    }),

    getDispatchBoard: build.query({
      query: (params) => ({ url: '/admin/dispatch/board', params }),
      transformResponse: (r) => r.data,
      providesTags: ['Dispatch'],
    }),
    getUnassignedJobs: build.query({
      query: (params = {}) => ({ url: '/admin/dispatch/unassigned', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['Dispatch'],
    }),
    /** Pickers: who can be sent (the list never carries a labour rate). */
    getDispatchTechnicians: build.query({
      query: (params = {}) => ({ url: '/admin/technicians', params: { limit: 100, ...params } }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: [{ type: 'Technician', id: 'LIST' }, { type: 'Cms', id: 'technicians' }],
    }),
  }),
});

export const {
  useGetJobsQuery, useGetJobQuery, useCreateJobMutation, useUpdateJobMutation, useDeleteJobMutation,
  useSetJobStatusMutation, useScheduleJobMutation, useAssignJobMutation, useCompleteJobMutation, useVerifyJobMutation,
  useAddJobTaskMutation, useUpdateJobTaskMutation, useDeleteJobTaskMutation,
  useAddJobPhotoMutation, useDeleteJobPhotoMutation,
  useIssueJobMaterialMutation, useReverseJobMaterialMutation,
  useAddJobTimeLogMutation, useDeleteJobTimeLogMutation,
  useGetJobCostingQuery, usePublishCaseStudyMutation, useGetJobPlanQuery, useOverrideJobAdvanceMutation,
  useGetJobProgressQuery, useGetJobPlannedVsActualQuery, useGetJobDiaryQuery, useGetJobVariationsQuery,
  useCreateShortfallPurchaseListMutation,
  useMeasureJobLineMutation, useCloseJobMeasurementMutation, useReopenJobMeasurementMutation, useOfferAmcMutation,
  useGetDispatchBoardQuery, useGetUnassignedJobsQuery, useGetDispatchTechniciansQuery,
} = jobsApi;
