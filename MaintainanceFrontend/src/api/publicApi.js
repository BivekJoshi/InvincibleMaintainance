import { apiSlice } from '@/api/apiSlice';

/**
 * Endpoints for the marketing site. No auth, cached by the server for 60s.
 *
 * Every content query carries the visitor's `locale` (`en` | `ne`, Phase J1): the API overlays a row's Nepali
 * translation where an editor wrote one and falls back to English where not. Availability takes none: its slots are
 * named by key, and the site words them.
 */
export const publicApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getBootstrap: build.query({
      query: (locale = 'en') => ({ url: '/public/bootstrap', params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    getHome: build.query({
      query: (locale = 'en') => ({ url: '/public/home', params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** The catalogue: `{ locale, category? }`. */
    getPublicServices: build.query({
      query: ({ locale = 'en', ...params } = {}) => ({ url: '/public/services', params: { locale, ...params } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    getPublicService: build.query({
      query: ({ slug, locale = 'en' }) => ({ url: `/public/services/${slug}`, params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** Case studies: `{ locale, service? }`. */
    getPublicProjects: build.query({
      query: ({ locale = 'en', ...params } = {}) => ({ url: '/public/projects', params: { locale, ...params } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    getPublicProject: build.query({
      query: ({ slug, locale = 'en' }) => ({ url: `/public/projects/${slug}`, params: { locale } }),
      transformResponse: (r) => r.data,
    }),
    getPublicPricing: build.query({
      query: (locale = 'en') => ({ url: '/public/pricing', params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** The "From the field" pictures, their captions in `locale` (a caption is translatable since Phase J1). */
    getPublicGallery: build.query({
      query: (locale = 'en') => ({ url: '/public/gallery', params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** `{ group?, locale }` — the FAQs of one group (a service's, say), or all of them. */
    getPublicFaqs: build.query({
      query: ({ group, locale = 'en' } = {}) => ({ url: '/public/faqs', params: { locale, ...(group ? { group } : {}) } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** Published posts, newest first, and the categories that have any. `{ locale, category?, limit? }`. */
    getPublicPosts: build.query({
      query: ({ locale = 'en', ...params } = {}) => ({ url: '/public/posts', params: { locale, ...params } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** One published post; a draft, scheduled or hidden post is 404. */
    getPublicPost: build.query({
      query: ({ slug, locale = 'en' }) => ({ url: `/public/posts/${encodeURIComponent(slug)}`, params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** A generic page served at `/:slug`; 404 when there is none, or it is switched off. */
    getPublicPage: build.query({
      query: ({ slug, locale = 'en' }) => ({ url: `/public/pages/${encodeURIComponent(slug)}`, params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    /** Live cost estimate — the conversion feature the old site lacked. */
    getAvailability: build.query({
      query: (params = {}) => ({ url: '/public/availability', params }),
      transformResponse: (r) => r.data,
      providesTags: ['Availability'],
    }),
    estimate: build.mutation({
      query: (body) => ({ url: '/public/estimate', method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    // Photos of the site, sent while the form is still open: the answer's ids go with the
    // enquiry as `photoIds`. FormData, so no JSON Content-Type is set for this one.
    uploadLeadPhotos: build.mutation({
      query: (files) => {
        const body = new FormData();
        [...files].forEach((file) => body.append('files', file));
        return { url: '/public/lead-photos', method: 'POST', body };
      },
      transformResponse: (r) => r.data,
    }),
    submitLead: build.mutation({
      query: (body) => ({ url: '/public/leads', method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    // Customer self-service by single-purpose token — no login.
    getQuotationByToken: build.query({
      query: (token) => `/public/quotations/${token}`,
      transformResponse: (r) => r.data,
    }),
    decideQuotation: build.mutation({
      query: ({ token, ...body }) => ({ url: `/public/quotations/${token}/decide`, method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    getInvoiceByToken: build.query({
      query: (token) => `/public/invoices/${token}`,
      transformResponse: (r) => r.data,
    }),
    getWarrantyByToken: build.query({
      query: (token) => `/public/warranties/${token}`,
      transformResponse: (r) => r.data,
    }),
    claimWarranty: build.mutation({
      query: ({ token, ...body }) => ({ url: `/public/warranties/${token}/claim`, method: 'POST', body }),
      transformResponse: (r) => r.data,
    }),
    /**
     * A booked site visit, for the customer's /visit/:token page (Phase L5): the window, the site, who is
     * coming, the answer so far and whether one can still be given (`canAnswer`). No money in it.
     */
    getVisitByToken: build.query({
      query: (token) => `/public/visits/${token}`,
      transformResponse: (r) => r.data,
    }),
    /**
     * The customer's answer — `{ token, answer: 'confirm' | 'reschedule', note? }`; the latest one wins. The API
     * answers with the visit as it now is, which replaces the page's copy, so the page shows the recorded state.
     */
    respondToVisit: build.mutation({
      query: ({ token, ...body }) => ({ url: `/public/visits/${token}/respond`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      async onQueryStarted({ token }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(publicApi.util.upsertQueryData('getVisitByToken', token, data));
        } catch { /* the page shows the error, and refetches on VISIT_CLOSED */ }
      },
    }),
  }),
});

export const {
  useGetBootstrapQuery, useGetHomeQuery, useGetPublicServicesQuery, useGetPublicServiceQuery,
  useGetPublicProjectsQuery, useGetPublicProjectQuery, useGetPublicPricingQuery,
  useGetPublicGalleryQuery, useGetPublicFaqsQuery,
  useGetPublicPostsQuery, useGetPublicPostQuery, useGetPublicPageQuery,
  useGetAvailabilityQuery,
  useEstimateMutation, useSubmitLeadMutation, useUploadLeadPhotosMutation,
  useGetQuotationByTokenQuery, useDecideQuotationMutation,
  useGetInvoiceByTokenQuery,
  useGetWarrantyByTokenQuery, useClaimWarrantyMutation,
  useGetVisitByTokenQuery, useRespondToVisitMutation,
} = publicApi;
