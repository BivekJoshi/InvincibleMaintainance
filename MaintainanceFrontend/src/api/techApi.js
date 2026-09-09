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
    completeMyJob: build.mutation({
      query: ({ id, ...body }) => ({ url: `/tech/jobs/${id}/complete`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }, { type: 'Job', id: 'TECH_TODAY' }, 'Dashboard'],
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
    getTechMaterials: build.query({
      query: () => '/tech/materials',
      transformResponse: (r) => r.data,
      providesTags: ['Material'],
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
  useGetTechRateCardQuery,
} = techApi;
