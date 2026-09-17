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
 */

const jobTag = (id) => ({ type: 'Job', id });
const costingTag = (id) => ({ type: 'Job', id: `costing:${id}` });
const LIST = { type: 'Job', id: 'LIST' };

/** A move of status, window or people. */
const moveTags = (result, error, { id }) => [
  jobTag(id), LIST, costingTag(id), 'Dispatch', 'Dashboard', 'History', 'Notification',
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
      invalidatesTags: [LIST, 'Dispatch', 'Dashboard', { type: 'Quotation', id: 'LIST' }],
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
    issueJobMaterial: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/jobs/${id}/materials`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [...costTags(result, error, arg), 'Stock', 'Dashboard'],
    }),
    reverseJobMaterial: build.mutation({
      query: ({ id, jobMaterialId }) => ({ url: `/admin/jobs/${id}/materials/${jobMaterialId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, arg) => [...costTags(result, error, arg), 'Stock', 'Dashboard'],
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
  useGetJobCostingQuery, usePublishCaseStudyMutation,
  useGetDispatchBoardQuery, useGetUnassignedJobsQuery, useGetDispatchTechniciansQuery,
} = jobsApi;
