import { apiSlice } from '@/api/apiSlice';

export const techApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getMyJobsToday: build.query({
      query: () => '/tech/jobs/today',
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Job', id: 'TECH_TODAY' }],
    }),
    getMyJobs: build.query({
      query: (params = {}) => ({ url: '/tech/jobs', params }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Job', id: 'TECH_LIST' }],
    }),
    getMyJob: build.query({
      query: (id) => `/tech/jobs/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Job', id }],
    }),
    setMyJobStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/jobs/${id}/status`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }, { type: 'Job', id: 'TECH_TODAY' }],
    }),
    toggleMyTask: build.mutation({
      query: ({ id, taskId, ...body }) => ({ url: `/tech/jobs/${id}/tasks/${taskId}`, method: 'PATCH', body }),
      // Optimistic: a technician on a bad connection sees the tick immediately.
      async onQueryStarted({ id, taskId, isDone }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          techApi.util.updateQueryData('getMyJob', id, (draft) => {
            const task = draft?.tasks?.find((t) => t.id === taskId);
            if (task) task.isDone = isDone;
          }),
        );
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),
    startMyTimer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/jobs/${id}/time/start`, method: 'POST', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),
    stopMyTimer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/jobs/${id}/time/stop`, method: 'POST', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),
    /**
     * Job photos — multipart `files` + `kind` (BEFORE | DURING | AFTER | ISSUE | SIGNATURE) + optional `caption`,
     * answered with `{ photos, media }`. `body` is the FormData; the field app sends it from its upload queue
     * (`hooks/useOfflineQueue.js`), never straight from a screen.
     */
    uploadMyJobPhotos: build.mutation({
      query: ({ id, body }) => ({ url: `/tech/jobs/${id}/photos`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),
    completeMyJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/jobs/${id}/complete`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }, { type: 'Job', id: 'TECH_TODAY' }, 'Dashboard'],
    }),
    /**
     * `PUT /tech/jobs/:id/lines/:lineId/measure { measurements }` (Phase L8) — the final measurement of one line from
     * site, for the people on the job. Quantities in and out: the answer is the line with the server's `measuredQty`,
     * never a rate. Written into the cached job at once, then the job is refetched. 422 MEASUREMENT_CLOSED, 422
     * LINE_NOT_MEASURED. It needs signal: `/tech/sync` has no kind for it.
     */
    measureMyJobLine: build.mutation({
      query: ({ id, lineId, measurements }) => ({ url: `/tech/jobs/${id}/lines/${lineId}/measure`, method: 'PUT', body: { measurements } }),
      transformResponse: (r) => r.data,
      async onQueryStarted({ id, lineId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(techApi.util.updateQueryData('getMyJob', id, (draft) => {
            const line = draft?.lines?.find((l) => l.id === lineId);
            if (line) Object.assign(line, { measurements: data.measurements, measuredQty: data.measuredQty });
          }));
        } catch { /* the screen says why */ }
      },
      invalidatesTags: (r, e, { id }) => (e ? [] : [{ type: 'Job', id }]),
    }),
    // ── site surveys. Quantities only: nothing here sends or receives a rate.
    getMySurveys: build.query({
      query: (params = {}) => ({ url: '/tech/surveys', params }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Survey', id: 'TECH_LIST' }],
    }),
    getMySurvey: build.query({
      query: (id) => `/tech/surveys/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Survey', id }],
    }),
    startJobSurvey: build.mutation({
      query: ({ jobId, surveyorId }) => ({ url: `/tech/jobs/${jobId}/survey`, method: 'POST', body: { surveyorId } }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Survey', id: 'TECH_LIST' }],
    }),
    saveSurveyDraft: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/surveys/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [{ type: 'Survey', id: arg.id }, { type: 'Survey', id: 'TECH_LIST' }],
    }),
    submitSurvey: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/surveys/${id}/submit`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [
        { type: 'Survey', id: arg.id }, { type: 'Survey', id: 'TECH_LIST' },
        { type: 'Job', id: 'TECH_TODAY' }, { type: 'Job', id: 'TECH_LIST' },
      ],
    }),
    uploadSurveyPhotos: build.mutation({
      query: ({ id, body }) => ({ url: `/tech/surveys/${id}/photos`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [{ type: 'Survey', id: arg.id }],
    }),
    getTechRateCard: build.query({
      query: () => '/tech/rate-card',
      transformResponse: (r) => r.data,
      providesTags: ['RateCard'],
    }),
    /** Reference data: code, name, unit — never a rate. Kept all shift, so the materials sheet works with no signal. */
    getTechMaterials: build.query({
      query: () => '/tech/materials',
      transformResponse: (r) => r.data,
      providesTags: ['Material'],
      keepUnusedDataFor: 12 * 60 * 60,
    }),
    // ── the site diary (Phase L7). No money: headcount per trade, progress per line, deliveries, lost time, photos.
    /**
     * `GET /tech/jobs/:id/diary` (own jobs) → `{ days: [{ day, weather, headcountTotal, lostHours, updatedAt }], today }`,
     * newest first — `today` is the server's Kathmandu day. Kept for the shift, so the list opens with no signal.
     */
    getMyDiary: build.query({
      query: (jobId) => `/tech/jobs/${jobId}/diary`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, jobId) => [{ type: 'Job', id: `diary:${jobId}` }],
      keepUnusedDataFor: 12 * 60 * 60,
    }),
    /**
     * `GET /tech/jobs/:id/diary/:day` → `{ day, entry: Diary | null, lines, trades, materials }` — the job's lines (no
     * rate), the trades and the materials a delivery can name. Loaded by the job page for today while there is signal
     * and kept for the shift, so the day can be filled in a basement. Every write goes through the queue
     * (`diary_save`, a full replace of the day), never straight from the screen.
     */
    getMyDiaryDay: build.query({
      query: ({ jobId, day }) => `/tech/jobs/${jobId}/diary/${day}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, { jobId, day }) => [{ type: 'Job', id: `diary:${jobId}:${day}` }],
      keepUnusedDataFor: 12 * 60 * 60,
    }),
    /** Replays the offline queue. Idempotency keys make a repeat send harmless. */
    syncOffline: build.mutation({
      query: (mutations) => ({ url: '/tech/sync', method: 'POST', body: { mutations } }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Job', id: 'TECH_TODAY' }, { type: 'Job', id: 'TECH_LIST' }],
    }),
  }),
});

export const {
  useGetMyJobsTodayQuery, useGetMyJobsQuery, useGetMyJobQuery,
  useSetMyJobStatusMutation, useToggleMyTaskMutation,
  useStartMyTimerMutation, useStopMyTimerMutation, useCompleteMyJobMutation,
  useGetTechMaterialsQuery, useSyncOfflineMutation,
  useGetMySurveysQuery,
  useGetMySurveyQuery,
  useStartJobSurveyMutation,
  useSaveSurveyDraftMutation,
  useSubmitSurveyMutation,
  useUploadSurveyPhotosMutation,
  useUploadMyJobPhotosMutation,
  useGetTechRateCardQuery,
  useGetMyDiaryQuery,
  useGetMyDiaryDayQuery,
  useMeasureMyJobLineMutation,
} = techApi;
