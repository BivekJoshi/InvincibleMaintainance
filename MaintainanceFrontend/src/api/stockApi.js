import { apiSlice } from '@/api/apiSlice';

/**
 * Stock (Phase H1): derived balances, movements, and "Record movement". The materials
 * themselves are a registry entry (`cmsApi`), whose writes also invalidate `Stock`
 * (`ALSO_READ_AS` there). Issuing to a job lives in `jobsApi`.
 *
 * Phase L7 — a purchase list's moves (the list itself is a registry entry, `purchase-lists`, read and saved through
 * `cmsApi`): `orderPurchaseList`, `receivePurchaseList` and `cancelPurchaseList`. Each answers the list and refreshes
 * it (the registry's `{ type: 'Cms', id: 'purchase-lists' }` and its record) and its History; receiving also refreshes
 * `Stock` and, for a job's list, the job's plan and planned-vs-actual. A wrong move is 422 INVALID_TRANSITION.
 */

const LISTS = { type: 'Cms', id: 'purchase-lists' };
const listTags = (result, error, { id, jobId }) => [
  LISTS, { type: 'Cms', id: `purchase-lists:${id}` }, 'History',
  ...(jobId ? [{ type: 'Job', id: `plan:${jobId}` }, { type: 'Job', id: `pva:${jobId}` }] : []),
];
export const stockApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getStock: build.query({
      query: (params = {}) => ({ url: '/admin/stock', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['Stock'],
    }),
    getStockMovements: build.query({
      query: (params = {}) => ({ url: '/admin/stock/movements', params }),
      transformResponse: (r) => ({ items: r.data, meta: r.meta }),
      providesTags: ['Stock'],
    }),
    /** PURCHASE, RETURN, ADJUSTMENT or WASTAGE. `rate` is in rupees. */
    recordStockMovement: build.mutation({
      query: (body) => ({ url: '/admin/stock/movements', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Stock', 'Dashboard', 'Notification'],
    }),
    /** `POST /admin/purchase-lists/:id/order` — DRAFT → ORDERED. `jobId` only picks the tags to refresh. */
    orderPurchaseList: build.mutation({
      query: ({ id }) => ({ url: `/admin/purchase-lists/${id}/order`, method: 'POST', body: {} }),
      transformResponse: (r) => r.data,
      invalidatesTags: listTags,
    }),
    /**
     * `POST /admin/purchase-lists/:id/receive { items?: [{ itemId, receivedQty }] }` — ORDERED → RECEIVED, with a PURCHASE
     * stock movement per item received (everything as ordered when `items` is left out).
     */
    receivePurchaseList: build.mutation({
      query: ({ id, items }) => ({ url: `/admin/purchase-lists/${id}/receive`, method: 'POST', body: items ? { items } : {} }),
      transformResponse: (r) => r.data,
      invalidatesTags: (result, error, arg) => [...listTags(result, error, arg), 'Stock', 'Dashboard'],
    }),
    /** `POST /admin/purchase-lists/:id/cancel { reason }` — DRAFT or ORDERED → CANCELLED. */
    cancelPurchaseList: build.mutation({
      query: ({ id, reason }) => ({ url: `/admin/purchase-lists/${id}/cancel`, method: 'POST', body: { reason } }),
      transformResponse: (r) => r.data,
      invalidatesTags: listTags,
    }),
  }),
});

export const {
  useGetStockQuery, useGetStockMovementsQuery, useRecordStockMovementMutation,
  useOrderPurchaseListMutation, useReceivePurchaseListMutation, useCancelPurchaseListMutation,
} = stockApi;
