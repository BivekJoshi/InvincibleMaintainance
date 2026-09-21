import { apiSlice } from '@/api/apiSlice';

/** Endpoints for the marketing site. No auth, cached by the server for 60s. */
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
    getPublicServices: build.query({
      query: (params = {}) => ({ url: '/public/services', params }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    getPublicService: build.query({
      query: ({ slug, locale = 'en' }) => ({ url: `/public/services/${slug}`, params: { locale } }),
      transformResponse: (r) => r.data,
      providesTags: ['Public'],
    }),
    getPublicProjects: build.query({
      query: (params = {}) => ({ url: '/public/projects', params }),
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
    getPublicGallery: build.query({
      query: () => '/public/gallery',
      transformResponse: (r) => r.data,
    }),
    getPublicFaqs: build.query({
      query: (group) => ({ url: '/public/faqs', params: group ? { group } : {} }),
      transformResponse: (r) => r.data,
    }),
    /** Published posts, newest first, and the categories that have any. `{ locale, category?, limit? }`. */
    getPublicPosts: build.query({
      query: (params = {}) => ({ url: '/public/posts', params }),
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
} = publicApi;
