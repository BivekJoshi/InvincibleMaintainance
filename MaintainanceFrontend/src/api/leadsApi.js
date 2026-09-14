import { apiSlice, tagList } from '@/api/apiSlice';

export const leadsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getLeads: build.query({
      query: (params = {}) => ({ url: '/admin/leads', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Lead'),
    }),
    getSlaBoard: build.query({
      query: () => '/admin/leads/sla-board',
      transformResponse: (r) => r.data,
      providesTags: ['LeadBoard'],
    }),
    getLead: build.query({
      query: (id) => `/admin/leads/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Lead', id }],
    }),
    getLeadDuplicates: build.query({
      query: (id) => `/admin/leads/${id}/duplicates`,
      transformResponse: (r) => r.data,
    }),
    createLead: build.mutation({
      query: (body) => ({ url: '/admin/leads', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Lead', id: 'LIST' }, 'LeadBoard', 'Dashboard'],
    }),
    updateLead: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }],
    }),
    setLeadStatus: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/status`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }, 'LeadBoard', 'Dashboard'],
    }),
    assignLead: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/assign`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }, 'LeadBoard'],
    }),
    addLeadNote: build.mutation({
      query: ({ id, note }) => ({ url: `/admin/leads/${id}/notes`, method: 'POST', body: { note } }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Lead', id }],
    }),
    // Logging contact is what stamps firstResponseAt and stops the SLA clock.
    addLeadActivity: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/activities`, method: 'POST', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: 'LIST' }, 'LeadBoard', 'Dashboard'],
    }),
    // Who is available to send on the visit. Filtered to surveyors by the caller.
    getTechnicians: build.query({
      query: (params = {}) => ({ url: '/admin/technicians', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: [{ type: 'Technician', id: 'LIST' }],
    }),
    convertLead: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/convert`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [
        { type: 'Lead', id }, { type: 'Lead', id: 'LIST' },
        { type: 'Customer', id: 'LIST' }, { type: 'Job', id: 'LIST' }, { type: 'Quotation', id: 'LIST' },
        { type: 'Survey', id: 'LIST' }, 'Availability',
        'LeadBoard', 'Dashboard',
      ],
    }),
    // Text, not a Blob: the cache holds only serialisable values. The page turns
    // it into a file. Lazy, and dropped from the cache as soon as nothing reads it.
    // Going through baseQuery is the point — it carries the Bearer token and
    // survives a 401 → refresh → retry, which window.open never could.
    exportLeadsCsv: build.query({
      query: (params = {}) => ({ url: '/admin/leads/export.csv', params, responseHandler: (res) => res.text() }),
      keepUnusedDataFor: 0,
    }),
    mergeLeads: build.mutation({
      query: (body) => ({ url: '/admin/leads/merge', method: 'POST', body }),
      invalidatesTags: [{ type: 'Lead', id: 'LIST' }, 'LeadBoard'],
    }),
    deleteLead: build.mutation({
      query: (id) => ({ url: `/admin/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Lead', id: 'LIST' }, 'LeadBoard', 'Dashboard'],
    }),
  }),
});

export const {
  useGetLeadsQuery, useGetSlaBoardQuery, useGetLeadQuery, useGetLeadDuplicatesQuery,
  useCreateLeadMutation, useUpdateLeadMutation, useSetLeadStatusMutation, useAssignLeadMutation,
  useAddLeadNoteMutation, useAddLeadActivityMutation, useConvertLeadMutation, useGetTechniciansQuery,
  useMergeLeadsMutation, useDeleteLeadMutation, useLazyExportLeadsCsvQuery,
} = leadsApi;
