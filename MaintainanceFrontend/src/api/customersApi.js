import { apiSlice, tagList } from '@/api/apiSlice';

/**
 * Customers and their sites. A lead convert creates both, so `convertLead` invalidates
 * `Customer` / `Site` lists too (see leadsApi).
 *
 * The record tabs (quotations, jobs, invoices, warranties, AMC) read each domain's own
 * list endpoint filtered by `customerId` through `getCustomerRecords`, so the customer
 * page needs none of those domains' API files.
 */
export const CUSTOMER_RECORD_PATHS = {
  quotations: '/admin/quotations',
  jobs: '/admin/jobs',
  invoices: '/admin/invoices',
  warranties: '/admin/warranties',
  contracts: '/admin/amc-contracts',
};

const RECORD_TAGS = { quotations: 'Quotation', jobs: 'Job', invoices: 'Invoice', warranties: 'Warranty', contracts: 'AmcContract' };

export const customersApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query({
      query: (params = {}) => ({ url: '/admin/customers', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: tagList('Customer'),
    }),
    // The list's header; any customer change can move its counts.
    getCustomerSummary: build.query({
      query: () => '/admin/customers/summary',
      transformResponse: (r) => r.data,
      providesTags: [{ type: 'Customer', id: 'LIST' }],
    }),
    getCustomer: build.query({
      query: (id) => `/admin/customers/${id}`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: build.mutation({
      query: (body) => ({ url: '/admin/customers', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }, 'Dashboard'],
    }),
    updateCustomer: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/customers/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { id }) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }, 'History'],
    }),
    deleteCustomer: build.mutation({
      query: (id) => ({ url: `/admin/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }, 'Dashboard'],
    }),
    getCustomerSites: build.query({
      query: (customerId) => `/admin/customers/${customerId}/sites`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, customerId) => [{ type: 'Site', id: `customer:${customerId}` }, { type: 'Site', id: 'LIST' }],
    }),
    createSite: build.mutation({
      query: ({ customerId, ...body }) => ({ url: `/admin/customers/${customerId}/sites`, method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { customerId }) => siteTags(customerId),
    }),
    updateSite: build.mutation({
      query: ({ customerId, id, ...body }) => ({ url: `/admin/customers/${customerId}/sites/${id}`, method: 'PUT', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: (r, e, { customerId }) => siteTags(customerId),
    }),
    deleteSite: build.mutation({
      query: ({ customerId, id }) => ({ url: `/admin/customers/${customerId}/sites/${id}`, method: 'DELETE' }),
      invalidatesTags: (r, e, { customerId }) => siteTags(customerId),
    }),
    getCustomerTimeline: build.query({
      query: (id) => `/admin/customers/${id}/timeline`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Customer', id }, { type: 'Lead', id: 'LIST' }],
    }),
    getCustomerStatement: build.query({
      query: (id) => `/admin/customers/${id}/statement`,
      transformResponse: (r) => r.data,
      providesTags: (result, error, id) => [{ type: 'Customer', id }, { type: 'Invoice', id: 'LIST' }],
    }),
    /** `kind` is a key of CUSTOMER_RECORD_PATHS. */
    getCustomerRecords: build.query({
      query: ({ kind, customerId, params = {} }) => ({ url: CUSTOMER_RECORD_PATHS[kind], params: { ...params, customerId } }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: (result, error, { kind }) => [{ type: RECORD_TAGS[kind], id: 'LIST' }],
    }),
  }),
});

function siteTags(customerId) {
  return [
    { type: 'Site', id: `customer:${customerId}` }, { type: 'Site', id: 'LIST' },
    { type: 'Customer', id: customerId }, { type: 'Customer', id: 'LIST' }, 'History',
  ];
}

export const {
  useGetCustomersQuery, useGetCustomerSummaryQuery, useGetCustomerQuery, useCreateCustomerMutation, useUpdateCustomerMutation,
  useDeleteCustomerMutation, useGetCustomerSitesQuery, useCreateSiteMutation, useUpdateSiteMutation,
  useDeleteSiteMutation, useGetCustomerTimelineQuery, useGetCustomerStatementQuery, useGetCustomerRecordsQuery,
} = customersApi;
