import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, reorderBody, toPartial } from '../../shared/schemas/common.js';
import * as cms from '../../services/cms.service.js';
import * as schemas from '../../shared/schemas/cms.js';

/**
 * Mounts the standard 8 endpoints for a CRUD service. Every CMS resource in the
 * system is registered through this function — there is no second pattern.
 */
function mountResource(router, path, service, schema, { capability = 'cms', extra } = {}) {
  const read = requires(`${capability}:read`);
  const write = requires(`${capability}:write`);

  router.get(`/${path}`, read, validate({ query: listQuery.passthrough() }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await service.list({ ...req.query, ...req.validatedQuery });
      ok(res, items, meta);
    }));

  router.patch(`/${path}/reorder`, write, validate({ body: reorderBody }),
    asyncHandler(async (req, res) => { await service.reorder(req.body.items); noContent(res); }));

  router.get(`/${path}/:id`, read, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.get(req.params.id))));

  router.post(`/${path}`, write, validate({ body: schema }),
    asyncHandler(async (req, res) => created(res, await service.create(req.body))));

  router.put(`/${path}/:id`, write, validate({ params: idParam, body: toPartial(schema) }),
    asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body))));

  router.patch(`/${path}/:id/toggle`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.toggle(req.params.id))));

  router.patch(`/${path}/:id/restore`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.restore(req.params.id))));

  router.delete(`/${path}/:id`, write, validate({ params: idParam }),
    asyncHandler(async (req, res) => { await service.remove(req.params.id, { hard: req.query.hard === 'true' }); noContent(res); }));

  extra?.(router, { read, write });
}

const router = Router();

mountResource(router, 'hero-slides', cms.heroSlides, schemas.heroSlideSchema);
mountResource(router, 'service-categories', cms.serviceCategories, schemas.serviceCategorySchema);
mountResource(router, 'services', cms.services, schemas.serviceSchema);
mountResource(router, 'offers', cms.offers, schemas.offerSchema);
mountResource(router, 'pricing-plans', cms.pricingPlans, schemas.pricingPlanSchema);
mountResource(router, 'features', cms.features, schemas.featureSchema);
mountResource(router, 'list-items', cms.listItems, schemas.listItemSchema);
mountResource(router, 'content-blocks', cms.contentBlocks, schemas.contentBlockSchema);
mountResource(router, 'process-steps', cms.processSteps, schemas.processStepSchema);
mountResource(router, 'gallery', cms.galleryImages, schemas.galleryImageSchema);
mountResource(router, 'faqs', cms.faqs, schemas.faqSchema);
mountResource(router, 'pages', cms.pages, schemas.pageSchema);
mountResource(router, 'post-categories', cms.postCategories, schemas.postCategorySchema);
mountResource(router, 'posts', cms.posts, schemas.postSchema);

mountResource(router, 'testimonials', cms.testimonials, schemas.testimonialSchema, {
  extra: (r) => {
    r.patch('/testimonials/:id/approve', requires('testimonials:moderate'), validate({ params: idParam }),
      asyncHandler(async (req, res) => ok(res, await cms.approveTestimonial(req.params.id, req.body?.isApproved !== false))));
  },
});

mountResource(router, 'projects', cms.projects, schemas.projectSchema, {
  extra: (r, { write }) => {
    r.post('/projects/:id/images', write, validate({ params: idParam, body: schemas.projectImageSchema }),
      asyncHandler(async (req, res) => created(res, await cms.addProjectImage(req.params.id, req.body))));
    r.patch('/projects/:id/images/reorder', write, validate({ params: idParam, body: reorderBody }),
      asyncHandler(async (req, res) => { await cms.reorderProjectImages(req.params.id, req.body.items); noContent(res); }));
    r.delete('/projects/:id/images/:imageId', write,
      asyncHandler(async (req, res) => { await cms.removeProjectImage(req.params.id, req.params.imageId); noContent(res); }));
  },
});

// ── home page composer
router.get('/home-sections', requires('cms:read'), asyncHandler(async (_req, res) => ok(res, await cms.listHomeSections())));
router.put('/home-sections', requires('cms:write'), validate({ body: schemas.homeSectionUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await cms.updateHomeSections(req.body.items))));

// ── translations
router.get('/translations', requires('cms:read'), asyncHandler(async (req, res) =>
  ok(res, await cms.getTranslations(String(req.query.model), String(req.query.recordId)))));
router.put('/translations', requires('cms:write'), validate({ body: schemas.translationUpsertSchema }),
  asyncHandler(async (req, res) => ok(res, await cms.upsertTranslations(req.body))));

export default router;
