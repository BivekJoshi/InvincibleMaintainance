/**
 * Core RTK Query pieces only. The per-domain endpoint files are deliberately
 * NOT re-exported here — a barrel would pull the back office's endpoints into
 * the marketing bundle. Import those directly, e.g. '@/api/leadsApi'.
 */
export { apiSlice, listAndItem, tagList } from './apiSlice';
export { baseQueryWithReauth, unwrap, unwrapWithMeta } from './baseQuery';
