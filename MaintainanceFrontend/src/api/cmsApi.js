import { apiSlice } from '@/api/apiSlice';
import { unwrapWithMeta } from '@/api/baseQuery';

/**
 * Every CMS resource the API mounts through its CRUD factory answers the same eight
 * endpoints under `/admin/<resource>`, so one set of endpoints serves them all —
 * `resource` is that path segment (`'faqs'`, `'process-steps'`).
 *
 * Tags: a resource's list is `{ type: 'Cms', id: resource }` and one record is
 * `{ type: 'Cms', id: 'resource:id' }`. Creating or reordering touches only the list;
 * changing a record touches the list and that record. Every write also invalidates
 * `Public`, because the API busts the site's cache on a CMS write and the SPA's own
 * cached copy of the site should follow.
 */

const listTag = (resource) => ({ type: 'Cms', id: resource });
const itemTag = (resource, id) => ({ type: 'Cms', id: `${resource}:${id}` });
const base = (resource) => `/admin/${resource}`;

/** The list and one record, plus the site's cache. */
const listAndRecord = (result, error, { resource, id }) => [listTag(resource), itemTag(resource, id), 'Public'];

export const cmsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listResource: build.query({
      query: ({ resource, params }) => ({ url: base(resource), params }),
      transformResponse: unwrapWithMeta,
      providesTags: (result, error, { resource }) => [listTag(resource)],
    }),
    getResource: build.query({
      query: ({ resource, id }) => `${base(resource)}/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, { resource, id }) => [itemTag(resource, id)],
    }),
    createResource: build.mutation({
      query: ({ resource, body }) => ({ url: base(resource), method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { resource }) => [listTag(resource), 'Public'],
    }),
    updateResource: build.mutation({
      query: ({ resource, id, body }) => ({ url: `${base(resource)}/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndRecord,
    }),
    toggleResource: build.mutation({
      query: ({ resource, id }) => ({ url: `${base(resource)}/${id}/toggle`, method: 'PATCH' }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndRecord,
    }),
    /** `items` is `[{ id, sortOrder }]` — what DataTable's reorder mode hands over. */
    reorderResource: build.mutation({
      query: ({ resource, items }) => ({ url: `${base(resource)}/reorder`, method: 'PATCH', body: { items } }),
      invalidatesTags: (result, error, { resource }) => [listTag(resource), 'Public'],
    }),
    /** Soft delete; `hard: true` removes the row for good and needs `cms:purge`. */
    deleteResource: build.mutation({
      query: ({ resource, id, hard }) => ({
        url: `${base(resource)}/${id}`,
        method: 'DELETE',
        ...(hard ? { params: { hard: 'true' } } : {}),
      }),
      invalidatesTags: listAndRecord,
    }),
    restoreResource: build.mutation({
      query: ({ resource, id }) => ({ url: `${base(resource)}/${id}/restore`, method: 'PATCH' }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndRecord,
    }),
  }),
});

export const {
  useListResourceQuery, useGetResourceQuery,
  useCreateResourceMutation, useUpdateResourceMutation, useToggleResourceMutation,
  useReorderResourceMutation, useDeleteResourceMutation, useRestoreResourceMutation,
} = cmsApi;
