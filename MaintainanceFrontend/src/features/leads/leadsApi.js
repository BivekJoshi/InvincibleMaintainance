import { apiSlice, tagList } from '@/app/api/apiSlice';

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
    convertLead: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/convert`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [
        { type: 'Lead', id }, { type: 'Lead', id: 'LIST' },
        { type: 'Customer', id: 'LIST' }, { type: 'Job', id: 'LIST' }, { type: 'Quotation', id: 'LIST' },
        'LeadBoard', 'Dashboard',
      ],
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
  useAddLeadNoteMutation, useAddLeadActivityMutation, useConvertLeadMutation,
  useMergeLeadsMutation, useDeleteLeadMutation,
} = leadsApi;
