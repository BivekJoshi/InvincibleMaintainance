import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQuery';

/**
 * One API slice for the whole app. Endpoints are injected per feature
 * (see features/<domain>/<domain>Api.js) so this file never grows.
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth', 'Dashboard', 'Notification',
    'Lead', 'LeadBoard', 'Customer', 'Site', 'Quotation', 'RateCard',
    'Survey', 'SurveyPricing', 'Availability',
    'Job', 'Dispatch', 'Technician', 'JobTemplate',
    'Material', 'Stock', 'Supplier',
    'Invoice', 'Payment', 'Expense',
    'Warranty', 'WarrantyClaim', 'AmcContract', 'Reminder',
    'Service', 'ServiceCategory', 'Project', 'Offer', 'PricingPlan', 'Feature',
    'ListItem', 'ContentBlock', 'ProcessStep', 'Testimonial', 'Gallery', 'Faq',
    'Page', 'Post', 'PostCategory', 'HomeSection', 'Translation',
    'Media', 'MediaFolder', 'Setting', 'User', 'Session', 'AuditLog', 'LoginActivity', 'History',
    'MessageTemplate', 'MessageLog', 'Report',
    'Public',
  ],
  // Staff data changes constantly; don't serve stale rows after a tab switch.
  refetchOnMountOrArgChange: 30,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/** Helper: invalidate a list plus the single item that changed. */
export const listAndItem = (type) => (result, error, arg) => [
  { type, id: 'LIST' },
  { type, id: typeof arg === 'string' ? arg : arg?.id },
];

/** Helper: tag every row in a list result plus the list itself. */
export const tagList = (type) => (result) =>
  result?.items
    ? [...result.items.map(({ id }) => ({ type, id })), { type, id: 'LIST' }]
    : [{ type, id: 'LIST' }];
