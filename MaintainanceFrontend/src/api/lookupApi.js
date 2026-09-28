import { apiSlice } from '@/api/apiSlice';

/**
 * Resource-agnostic lookups for pickers: a relation filter in `<CustomTable>` and a
 * relation field in `<ResourceForm>` both search an admin list endpoint by `q` and
 * resolve one id back to a label. They name the endpoint by path, so neither needs
 * a domain API file of its own.
 *
 * Nothing here is tagged: a lookup is a short-lived read, and a stale label in a
 * combobox for thirty seconds costs nothing.
 */
export const lookupApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    searchRecords: build.query({
      query: ({ path, q, limit = 20, params }) => ({
        url: path,
        params: { limit, ...(q ? { q } : {}), ...params },
      }),
      transformResponse: (r) => r.data ?? [],
      keepUnusedDataFor: 30,
    }),
    getRecord: build.query({
      query: ({ path, id }) => `${path}/${id}`,
      transformResponse: (r) => r.data,
      keepUnusedDataFor: 60,
    }),
    /**
     * Words a text field suggests (Phase I): an endpoint answering `string[]` — the expense categories in use. The
     * one tagged lookup: `tag` (the list the words come from) refreshes it after a save adds a new word.
     */
    getSuggestions: build.query({
      query: ({ path, params }) => ({ url: path, params }),
      transformResponse: (r) => (Array.isArray(r?.data) ? r.data.filter((w) => typeof w === 'string' && w) : []),
      providesTags: (result, error, { tag }) => (tag ? [tag] : []),
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useSearchRecordsQuery, useGetRecordQuery, useGetSuggestionsQuery } = lookupApi;
