import { apiSlice, listAndItem, tagList } from '@/api/apiSlice';

/**
 * The office side of a site survey: read what the surveyor reported, price it,
 * and turn it into a quotation.
 *
 * Pricing is a separate tag from the survey itself because it is guarded by a
 * different capability (quotations:read) and can 403 on its own while the survey
 * body loads fine.
 */
export const surveysApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getSurveys: build.query({
      query: (params = {}) => ({ url: '/admin/surveys', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Survey'),
    }),
    /** How many surveys a queue holds — a tab's count. `statuses` is comma separated. */
    getSurveyStageCount: build.query({
      query: (statuses) => ({ url: '/admin/surveys', params: { status: statuses, limit: 1 } }),
      transformResponse: (r) => r.meta?.total ?? 0,
      providesTags: [{ type: 'Survey', id: 'LIST' }],
    }),
    getSurvey: build.query({
      query: (id) => `/admin/surveys/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Survey', id }],
    }),
    getSurveyPricing: build.query({
      query: (id) => `/admin/surveys/${id}/pricing`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'SurveyPricing', id }],
    }),
    reviewSurvey: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/surveys/${id}/review`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: listAndItem('Survey'),
    }),
    buildQuotationFromSurvey: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/surveys/${id}/quotation`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [
        { type: 'Survey', id: 'LIST' },
        { type: 'Survey', id: arg.id },
        { type: 'SurveyPricing', id: arg.id },
        { type: 'Quotation', id: 'LIST' },
        { type: 'Lead', id: 'LIST' },
        'Dashboard',
      ],
    }),
    deleteSurvey: build.mutation({
      query: (id) => ({ url: `/admin/surveys/${id}`, method: 'DELETE' }),
      invalidatesTags: listAndItem('Survey'),
    }),
  }),
});

export const {
  useGetSurveysQuery,
  useGetSurveyQuery,
  useGetSurveyStageCountQuery,
  useGetSurveyPricingQuery,
  useReviewSurveyMutation,
  useBuildQuotationFromSurveyMutation,
  useDeleteSurveyMutation,
} = surveysApi;
