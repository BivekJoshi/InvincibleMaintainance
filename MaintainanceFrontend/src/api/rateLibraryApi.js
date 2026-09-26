import { apiSlice } from '@/api/apiSlice';

/**
 * The rate library's two calls beyond the registry's eight (Phase L2). The library itself — list, get,
 * create, update, toggle, reorder, delete, restore — goes through `cmsApi` like every registry entry.
 *
 * - `deriveRateCost` — `POST /admin/rate-card/derive` (`costs:read`): a recipe's cost breakdown and
 *   derived rate at today's prices, nothing saved. A query, not a mutation: the edit form's Cost vs rate
 *   card asks again whenever the recipe changes, and the same recipe is answered from the cache. The
 *   body is rupees, as every request is.
 * - `repriceRateCard` — `POST /admin/rate-card/reprice` (`rates:write`): `apply: false` previews what
 *   would change (`{ items: [{ id, code, name, rate, derivedRate, delta }] }`) and writes nothing;
 *   `apply: true` sets each rate to its derived rate and answers `applied`.
 */

const LIBRARY = { type: 'Cms', id: 'rate-card' };
const ITEM = (id) => ({ type: 'Cms', id: `rate-card:${id}` });

export const rateLibraryApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    deriveRateCost: build.query({
      query: (body) => ({ url: '/admin/rate-card/derive', method: 'POST', body }),
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'RateCard', id: 'DERIVE' }],
      keepUnusedDataFor: 30,
    }),
    repriceRateCard: build.mutation({
      query: ({ ids, apply }) => ({ url: '/admin/rate-card/reprice', method: 'POST', body: { ...(ids ? { ids } : {}), apply } }),
      transformResponse: (r) => r.data,
      // A preview changes nothing; an applied reprice moves rates the site, the builder and History show.
      invalidatesTags: (result, error, { apply }) => (apply && !error
        ? [LIBRARY, ...(result?.items ?? []).map((i) => ITEM(i.id)), { type: 'RateCard', id: 'LIST' }, 'Public', 'History']
        : []),
    }),
  }),
});

export const { useDeriveRateCostQuery, useRepriceRateCardMutation } = rateLibraryApi;
