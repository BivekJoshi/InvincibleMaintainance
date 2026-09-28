import { apiSlice, tagList } from '@/api/apiSlice';

/** The media library: the picker's reads and uploads, and the library screen's edits and folders. */
export const mediaApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getMediaList: build.query({
      query: (params = {}) => ({ url: '/admin/media', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Media'),
    }),
    getMediaFolders: build.query({
      query: () => '/admin/media/folders',
      transformResponse: (r) => r.data,
      providesTags: ['MediaFolder'],
    }),
    getMedia: build.query({
      query: (id) => `/admin/media/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Media', id }],
    }),
    /**
     * One file per request. The API takes a single `alt` for the whole multipart
     * batch, and every picture needs its own.
     */
    uploadMedia: build.mutation({
      query: ({ file, alt, folderId }) => {
        const body = new FormData();
        if (alt) body.append('alt', alt);
        if (folderId) body.append('folderId', folderId);
        body.append('files', file);
        return { url: '/admin/media', method: 'POST', body };
      },
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Media', id: 'LIST' }],
    }),
    /**
     * One picture to an upload endpoint of the caller's own (Phase I: `POST /admin/expenses/bill`, `expenses:write`) —
     * multipart, the file under `files` — answered 201 with the media object (`{ id, url, thumb, … }`). The kit's
     * `photoUpload` field sends through it, for a role that may not browse the library (no `media:read`).
     */
    uploadPhotoTo: build.mutation({
      query: ({ path, file }) => {
        const body = new FormData();
        body.append('files', file);
        return { url: path, method: 'POST', body };
      },
      transformResponse: (r) => (Array.isArray(r?.data) ? r.data[0] : r?.data),
    }),
    /** `{ alt, caption, folderId }` — alt text can change but not be emptied; `folderId: null` moves a file out. */
    updateMedia: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/media/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, { id }) => [{ type: 'Media', id }, { type: 'Media', id: 'LIST' }, 'Public'],
    }),
    /** Soft delete; `hard: true` removes the file for good and needs `cms:purge`. */
    deleteMedia: build.mutation({
      query: ({ id, hard }) => ({ url: `/admin/media/${id}`, method: 'DELETE', ...(hard ? { params: { hard: 'true' } } : {}) }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Media', id }, { type: 'Media', id: 'LIST' }, 'Public'],
    }),
    createMediaFolder: build.mutation({
      query: (body) => ({ url: '/admin/media/folders', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['MediaFolder'],
    }),
    /** Only an empty folder is deleted; the API answers 400 otherwise. */
    deleteMediaFolder: build.mutation({
      query: (id) => ({ url: `/admin/media/folders/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MediaFolder'],
    }),
  }),
});

export const {
  useGetMediaListQuery, useGetMediaFoldersQuery, useGetMediaQuery, useUploadMediaMutation, useUploadPhotoToMutation,
  useUpdateMediaMutation, useDeleteMediaMutation, useCreateMediaFolderMutation, useDeleteMediaFolderMutation,
} = mediaApi;
