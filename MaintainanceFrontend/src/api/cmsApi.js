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

/**
 * Other screens that read a resource through their own endpoint: the quotation builder reads the
 * rate card, the stock page the materials, the board and the job pickers the technicians and templates.
 */
const ALSO_READ_AS = {
  'rate-card': [{ type: 'RateCard', id: 'LIST' }],
  materials: ['Stock'],
  'material-categories': ['Stock'],
  technicians: ['Dispatch', { type: 'Technician', id: 'LIST' }],
};
const alsoFor = (resource) => ALSO_READ_AS[resource] ?? [];

/** The list and one record, plus the site's cache. */
const listAndRecord = (result, error, { resource, id }) => [listTag(resource), itemTag(resource, id), 'Public', ...alsoFor(resource)];

const projectTags = (projectId) => [listTag('projects'), itemTag('projects', projectId), 'Public'];

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
      invalidatesTags: (result, error, { resource }) => [listTag(resource), 'Public', ...alsoFor(resource)],
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
    /** `items` is `[{ id, sortOrder }]` — what CustomTable's reorder mode hands over. */
    reorderResource: build.mutation({
      query: ({ resource, items }) => ({ url: `${base(resource)}/reorder`, method: 'PATCH', body: { items } }),
      invalidatesTags: (result, error, { resource }) => [listTag(resource), 'Public', ...alsoFor(resource)],
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

    /** `isApproved: false` takes a testimonial off the site again. Needs `testimonials:moderate`. */
    approveTestimonial: build.mutation({
      query: ({ id, isApproved = true }) => ({ url: `/admin/testimonials/${id}/approve`, method: 'PATCH', body: { isApproved } }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [listTag('testimonials'), itemTag('testimonials', id), 'Public'],
    }),

    /** A project's gallery. Each call changes the project record, so it refetches. */
    addProjectImage: build.mutation({
      query: ({ projectId, ...body }) => ({ url: `/admin/projects/${projectId}/images`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { projectId }) => projectTags(projectId),
    }),
    /** `items` is `[{ id, sortOrder }]` of the project's images. */
    reorderProjectImages: build.mutation({
      query: ({ projectId, items }) => ({ url: `/admin/projects/${projectId}/images/reorder`, method: 'PATCH', body: { items } }),
      invalidatesTags: (result, error, { projectId }) => projectTags(projectId),
    }),
    removeProjectImage: build.mutation({
      query: ({ projectId, imageId }) => ({ url: `/admin/projects/${projectId}/images/${imageId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { projectId }) => projectTags(projectId),
    }),

    /** The home page composer: every section in order, with its visibility and settings. */
    getHomeSections: build.query({
      query: () => '/admin/home-sections',
      transformResponse: (r) => r.data,
      providesTags: [listTag('home-sections')],
    }),
    /** `items` is every section as `{ key, sortOrder, isVisible, settings? }`; answers the saved list. */
    updateHomeSections: build.mutation({
      query: (items) => ({ url: '/admin/home-sections', method: 'PUT', body: { items } }),
      transformResponse: (r) => r.data,
      invalidatesTags: [listTag('home-sections'), 'Public'],
    }),
  }),
});

export const {
  useGetHomeSectionsQuery, useUpdateHomeSectionsMutation,
  useListResourceQuery, useGetResourceQuery,
  useCreateResourceMutation, useUpdateResourceMutation, useToggleResourceMutation,
  useReorderResourceMutation, useDeleteResourceMutation, useRestoreResourceMutation,
  useApproveTestimonialMutation,
  useAddProjectImageMutation, useReorderProjectImagesMutation, useRemoveProjectImageMutation,
} = cmsApi;
