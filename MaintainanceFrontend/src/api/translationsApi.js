import { apiSlice } from '@/api/apiSlice';

const tag = ({ model, recordId }) => [{ type: 'Translation', id: `${model}:${recordId}` }];

/**
 * `/admin/translations` — the Nepali copy of a CMS record, keyed by Prisma model
 * name (`service`, `faq`…) and record id. The response is `{ field: { ne: '…' } }`.
 * Saving an empty string removes that translation, so the site falls back to English.
 */
export const translationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getTranslations: build.query({
      query: ({ model, recordId }) => ({ url: '/admin/translations', params: { model, recordId } }),
      transformResponse: (r) => r.data ?? {},
      providesTags: (result, error, arg) => tag(arg),
    }),
    saveTranslations: build.mutation({
      query: (body) => ({ url: '/admin/translations', method: 'PUT', body }),
      transformResponse: (r) => r.data ?? {},
      invalidatesTags: (result, error, arg) => tag(arg),
    }),
  }),
});

export const { useGetTranslationsQuery, useSaveTranslationsMutation } = translationsApi;
