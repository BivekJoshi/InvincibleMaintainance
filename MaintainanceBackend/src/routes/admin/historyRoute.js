import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok } from '../../utils/response.js';
import { historyQuery, idParam } from '../../shared/schemas/common.js';
import { recordHistory } from '../../services/history.service.js';

/**
 * `GET …/:id/history` for one model — a record's own audit trail, paginated, newest first:
 *
 *   router.get('/jobs/:id/history', ...historyRoute('Job', 'jobs:history'));
 *
 * @param {string} model       Prisma model name
 * @param {string} capability  who may read the trail
 */
export const historyRoute = (model, capability) => [
  requires(capability),
  validate({ params: idParam, query: historyQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await recordHistory(model, req.params.id, req.validatedQuery);
    ok(res, items, meta);
  }),
];
