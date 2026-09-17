import { apiSlice } from '@/api/apiSlice';

/**
 * Message templates (by key, with their language and channel variants) and the delivery
 * log (ADMIN).
 */
const templateTags = [{ type: 'MessageTemplate', id: 'LIST' }, 'AuditLog'];

export const messagesApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getTemplateGroups: build.query({
      query: (params = {}) => ({ url: '/admin/message-templates/groups', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: [{ type: 'MessageTemplate', id: 'LIST' }],
    }),
    /** Every variant of one key. */
    getTemplatesByKey: build.query({
      query: (key) => ({ url: '/admin/message-templates', params: { key, limit: 100 } }),
      transformResponse: (r) => r.data,
      providesTags: (result, error, key) => [{ type: 'MessageTemplate', id: `key:${key}` }, { type: 'MessageTemplate', id: 'LIST' }],
    }),
    createTemplate: build.mutation({
      query: (body) => ({ url: '/admin/message-templates', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: templateTags,
    }),
    updateTemplate: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/message-templates/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: templateTags,
    }),
    deleteTemplate: build.mutation({
      query: (id) => ({ url: `/admin/message-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: templateTags,
    }),
    /**
     * A read that happens to be a POST: `{ id?, vars, subject?, body? }` → the rendered text,
     * its placeholders and the missing ones. Without an id it previews unsaved text.
     */
    previewTemplate: build.query({
      query: ({ id, ...body }) => ({
        url: id ? `/admin/message-templates/${id}/preview` : '/admin/message-templates/preview',
        method: 'POST',
        body,
      }),
      transformResponse: (r) => r.data,
      keepUnusedDataFor: 10,
    }),
    getMessageLogs: build.query({
      query: (params = {}) => ({ url: '/admin/message-logs', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['MessageLog'],
    }),
    retryMessage: build.mutation({
      query: (id) => ({ url: `/admin/message-logs/${id}/retry`, method: 'POST' }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['MessageLog', 'AuditLog', 'Quotation'],
    }),
  }),
});

export const {
  useGetTemplateGroupsQuery, useGetTemplatesByKeyQuery, useCreateTemplateMutation, useUpdateTemplateMutation,
  useDeleteTemplateMutation, usePreviewTemplateQuery, useGetMessageLogsQuery, useRetryMessageMutation,
} = messagesApi;
