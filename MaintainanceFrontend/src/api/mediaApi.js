import { apiSlice, tagList } from '@/api/apiSlice';

/** The media library as the picker needs it. The full library screen (Phase D) adds to this file. */
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
  }),
});

export const {
  useGetMediaListQuery, useGetMediaFoldersQuery, useGetMediaQuery, useUploadMediaMutation,
} = mediaApi;
