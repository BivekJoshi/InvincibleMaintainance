import { apiSlice, listAndItem, tagList } from '@/api/apiSlice';

/**
 * Aftercare (Phase I): warranties, their claims, AMC contracts and service reminders — `warranties:*`, `amc:*`
 * and `reminders:*`. Lists answer `{ items, meta }`; a record answers itself.
 *
 * A list is tagged `{ type, id: 'LIST' }` — the same tag the customer page's Warranties and AMC tabs read
 * (`customersApi#getCustomerRecords`), so a change here refreshes them too.
 */

const list = (r) => ({ items: r.data, meta: r.meta });
const one = (r) => r.data;

export const aftercareApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // ── warranties
    getWarranties: build.query({
      query: (params = {}) => ({ url: '/admin/warranties', params }),
      transformResponse: list,
      providesTags: tagList('Warranty'),
    }),
    getWarranty: build.query({
      query: (id) => `/admin/warranties/${id}`,
      transformResponse: one,
      providesTags: (result, error, id) => [{ type: 'Warranty', id }],
    }),
    /** `{ id, scope?, endsAt? }` — the status is the server's; voiding has its own call. */
    updateWarranty: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/warranties/${id}`, method: 'PUT', body }),
      transformResponse: one,
      invalidatesTags: (result, error, arg) => [...listAndItem('Warranty')(result, error, arg), 'Dashboard', 'History'],
    }),
    voidWarranty: build.mutation({
      query: ({ id, reason }) => ({ url: `/admin/warranties/${id}/void`, method: 'POST', body: { reason } }),
      transformResponse: one,
      invalidatesTags: (result, error, arg) => [...listAndItem('Warranty')(result, error, arg), 'Dashboard', 'History'],
    }),

    // ── claims
    getWarrantyClaims: build.query({
      query: (params = {}) => ({ url: '/admin/warranty-claims', params }),
      transformResponse: list,
      providesTags: tagList('WarrantyClaim'),
    }),
    getWarrantyClaim: build.query({
      query: (id) => `/admin/warranty-claims/${id}`,
      transformResponse: one,
      providesTags: (result, error, id) => [{ type: 'WarrantyClaim', id }],
    }),
    /**
     * `{ id, status: 'accepted', scheduledStart? }` | `{ id, status: 'rejected', rejectReason }` | `{ id, status: 'resolved' }`
     * → the claim (with `resolvedJob`). Accepting makes a free WARRANTY job, unassigned — the dispatch queue's.
     */
    decideWarrantyClaim: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/warranty-claims/${id}`, method: 'PATCH', body }),
      transformResponse: one,
      invalidatesTags: (result, error, { id }) => [
        { type: 'WarrantyClaim', id: 'LIST' }, { type: 'WarrantyClaim', id },
        { type: 'Warranty', id: 'LIST' }, ...(result?.warranty?.id ? [{ type: 'Warranty', id: result.warranty.id }] : []),
        { type: 'Job', id: 'LIST' }, 'Dispatch', 'Dashboard', 'Notification', 'History',
      ],
    }),
    /**
     * `GET /admin/reports/warranty-claims` (`reports:ops`): `{ totalWarranties, totalClaims, claimRate, byType,
     * byService }` — the claims queue shows the rate for a claim's service. Others get 403 and no panel.
     */
    getWarrantyClaimRates: build.query({
      query: (params = {}) => ({ url: '/admin/reports/warranty-claims', params }),
      transformResponse: one,
      providesTags: [{ type: 'Report', id: 'warranty-claims' }, { type: 'WarrantyClaim', id: 'LIST' }],
    }),

    // ── AMC contracts
    getAmcContracts: build.query({
      query: (params = {}) => ({ url: '/admin/amc-contracts', params }),
      transformResponse: list,
      providesTags: tagList('AmcContract'),
    }),
    getAmcContract: build.query({
      query: (id) => `/admin/amc-contracts/${id}`,
      transformResponse: one,
      providesTags: (result, error, id) => [{ type: 'AmcContract', id }],
    }),
    /**
     * `{ startDate, endDate, visitsPerYear }` → `{ totalVisits, intervalDays, visits: [{ dueDate }] }`: the schedule
     * create would lay down. A **query** although it is a POST — it reads, and the create sheet asks again as the
     * dates change (like `previewTemplate`).
     */
    previewAmcSchedule: build.query({
      query: (body) => ({ url: '/admin/amc-contracts/preview', method: 'POST', body }),
      transformResponse: one,
      keepUnusedDataFor: 60,
    }),
    /** Amount in rupees; the API stores paisa. */
    createAmcContract: build.mutation({
      query: (body) => ({ url: '/admin/amc-contracts', method: 'POST', body }),
      transformResponse: one,
      invalidatesTags: [{ type: 'AmcContract', id: 'LIST' }, 'Dashboard'],
    }),
    /** Everything but the schedule (a new schedule is a renewal); `status` moves between active and cancelled. */
    updateAmcContract: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/amc-contracts/${id}`, method: 'PUT', body }),
      transformResponse: one,
      invalidatesTags: (result, error, arg) => [...listAndItem('AmcContract')(result, error, arg), 'Dashboard', 'History'],
    }),
    /** Removes the contract from every list (the API's soft delete; it is also marked cancelled). */
    deleteAmcContract: build.mutation({
      query: (id) => ({ url: `/admin/amc-contracts/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, error, id) => [{ type: 'AmcContract', id: 'LIST' }, { type: 'AmcContract', id }, 'Dashboard'],
    }),

    // ── service reminders
    getServiceReminders: build.query({
      query: (params = {}) => ({ url: '/admin/service-reminders', params }),
      transformResponse: list,
      providesTags: tagList('Reminder'),
    }),
    createServiceReminder: build.mutation({
      query: (body) => ({ url: '/admin/service-reminders', method: 'POST', body }),
      transformResponse: one,
      invalidatesTags: [{ type: 'Reminder', id: 'LIST' }],
    }),
    /** Pending only — 422 once it went out. */
    updateServiceReminder: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/service-reminders/${id}`, method: 'PUT', body }),
      transformResponse: one,
      invalidatesTags: listAndItem('Reminder'),
    }),
    /** Pending only — 422 once it went out. */
    deleteServiceReminder: build.mutation({
      query: (id) => ({ url: `/admin/service-reminders/${id}`, method: 'DELETE' }),
      invalidatesTags: listAndItem('Reminder'),
    }),
  }),
});

export const {
  useGetWarrantiesQuery, useGetWarrantyQuery, useUpdateWarrantyMutation, useVoidWarrantyMutation,
  useGetWarrantyClaimsQuery, useGetWarrantyClaimQuery, useDecideWarrantyClaimMutation, useGetWarrantyClaimRatesQuery,
  useGetAmcContractsQuery, useGetAmcContractQuery, usePreviewAmcScheduleQuery, useCreateAmcContractMutation,
  useUpdateAmcContractMutation, useDeleteAmcContractMutation,
  useGetServiceRemindersQuery, useCreateServiceReminderMutation, useUpdateServiceReminderMutation, useDeleteServiceReminderMutation,
} = aftercareApi;
