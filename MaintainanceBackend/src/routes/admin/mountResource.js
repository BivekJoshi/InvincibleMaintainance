import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, reorderBody, toPartial } from '../../shared/schemas/common.js';
import { historyRoute } from './historyRoute.js';

/**
 * Mounts the standard endpoints for a CRUD service — the eight the generic registry screens
 * call, plus the record's history (`GET /:id/history`). Every registry resource (CMS content,
 * materials, job templates, technicians) is mounted through this function — there is no second
 * pattern.
 *
 * `capability` is the prefix: `cms` guards reads with `cms:read` and writes with `cms:write`.
 * The history route needs `<capability>:read` unless `historyCapability` says otherwise; a role
 * that reads a resource through `readAlso` reads its records, not their trail.
 *
 * `list` and `get` receive `{ role }` as a second argument, for a service that shapes a row by
 * who asks (a technician's labour rate).
 *
 * @param {import('express').Router} router
 * @param {string} path  URL segment, e.g. 'faqs'
 * @param {object} service  a `makeCrud` service, or one with the same methods and a `model`
 * @param {import('zod').ZodTypeAny} schema  the create body; updates take its partial
 * @param {object} [opts]
 * @param {string} [opts.capability]
 * @param {string[]} [opts.readAlso]
 * @param {string} [opts.historyCapability]
 * @param {import('zod').ZodTypeAny} [opts.query]  the list query (default: `listQuery`, passthrough)
 * @param {import('zod').ZodTypeAny} [opts.updateSchema]  default `toPartial(schema)`
 * @param {(router: import('express').Router, guards: { read: Function, write: Function }) => void} [opts.extra]
 *   extra routes, mounted before `/:id` so a static segment wins
 */
export function mountResource(router, path, service, schema, {
  capability = 'cms', readAlso = [], historyCapability, query, updateSchema, extra,
} = {}) {
  const read = requires(`${capability}:read`, ...readAlso);
  const write = requires(`${capability}:write`);
  const ctx = (req) => ({ role: req.user.role });

  router.get(`/${path}`, read, validate({ query: query ?? listQuery.passthrough() }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await service.list({ ...req.query, ...req.validatedQuery }, ctx(req));
      ok(res, items, meta);
    }));

  router.patch(`/${path}/reorder`, write, validate({ body: reorderBody }),
    asyncHandler(async (req, res) => { await service.reorder(req.body.items); noContent(res); }));

  extra?.(router, { read, write });

  router.get(`/${path}/:id`, read, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.get(req.params.id, ctx(req)))));

  const modelName = service.model.charAt(0).toUpperCase() + service.model.slice(1);
  router.get(`/${path}/:id/history`, ...historyRoute(modelName, historyCapability ?? `${capability}:read`));

  router.post(`/${path}`, write, validate({ body: schema }),
    asyncHandler(async (req, res) => created(res, await service.create(req.body, ctx(req)))));

  router.put(`/${path}/:id`, write, validate({ params: idParam, body: updateSchema ?? toPartial(schema) }),
    asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body, ctx(req)))));

  router.patch(`/${path}/:id/toggle`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.toggle(req.params.id, ctx(req)))));

  router.patch(`/${path}/:id/restore`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.restore(req.params.id, ctx(req)))));

  router.delete(`/${path}/:id`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      await service.remove(req.params.id, { hard: req.query.hard === 'true', role: req.user.role });
      noContent(res);
    }));
}
