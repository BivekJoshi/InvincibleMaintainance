import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { leadLimiter } from '../middleware/rateLimit.js';
import { cached } from '../services/cache.service.js';
import { ok, created } from '../utils/response.js';
import * as pub from '../services/public.service.js';
import * as leads from '../services/lead.service.js';
import * as quotations from '../services/quotation.service.js';
import * as invoices from '../services/invoice.service.js';
import * as warranty from '../services/warranty.service.js';
import { estimate } from '../services/estimate.service.js';
import { surveyAvailability } from '../services/availability.service.js';
import { publicLeadSchema, estimateSchema, quotationDecisionSchema } from '../shared/schemas/crm.js';
import { warrantyClaimSchema } from '../shared/schemas/ops.js';
import { slugParam, tokenParam } from '../shared/schemas/common.js';

const router = Router();
const TTL = 60;
const locale = (req) => (req.query.locale === 'ne' ? 'ne' : 'en');

// ── content (cached)
router.get('/bootstrap', cached(TTL, 'bootstrap'), asyncHandler(async (req, res) => ok(res, await pub.bootstrap(locale(req)))));
router.get('/home', cached(TTL, 'home'), asyncHandler(async (req, res) => ok(res, await pub.home(locale(req)))));
router.get('/services', cached(TTL, 'services'), asyncHandler(async (req, res) => ok(res, await pub.listServices(req.query, locale(req)))));
router.get('/services/:slug', cached(TTL, 'services'), validate({ params: slugParam }), asyncHandler(async (req, res) => ok(res, await pub.getService(req.params.slug, locale(req)))));
router.get('/projects', cached(TTL, 'projects'), asyncHandler(async (req, res) => ok(res, await pub.listProjects(req.query, locale(req)))));
router.get('/projects/:slug', cached(TTL, 'projects'), validate({ params: slugParam }), asyncHandler(async (req, res) => ok(res, await pub.getProject(req.params.slug, locale(req)))));
router.get('/offers', cached(30, 'offers'), asyncHandler(async (req, res) => ok(res, await pub.listOffers(locale(req)))));
// 30s rather than the usual 60: nothing busts this cache when a booking lands,
// so the window in which two customers can be offered the last slot is the TTL.
router.get('/availability', cached(30, 'availability'), asyncHandler(async (req, res) =>
  ok(res, await surveyAvailability({ from: req.query.from, days: Number(req.query.days) || 14 }))));

router.get('/pricing', cached(TTL, 'pricing'), asyncHandler(async (req, res) => ok(res, await pub.pricing(locale(req)))));
router.get('/gallery', cached(TTL, 'gallery'), asyncHandler(async (_req, res) => ok(res, await pub.listGallery())));
router.get('/testimonials', cached(TTL, 'testimonials'), asyncHandler(async (req, res) => ok(res, await pub.listTestimonials(locale(req)))));
router.get('/faqs', cached(TTL, 'faqs'), asyncHandler(async (req, res) => ok(res, { items: await pub.listFaqs(req.query.group) })));
router.get('/posts', cached(TTL, 'posts'), asyncHandler(async (req, res) => ok(res, await pub.listPosts(req.query))));
router.get('/posts/:slug', cached(TTL, 'posts'), validate({ params: slugParam }), asyncHandler(async (req, res) => ok(res, await pub.getPost(req.params.slug))));
router.get('/pages/:slug', cached(TTL, 'pages'), validate({ params: slugParam }), asyncHandler(async (req, res) => ok(res, await pub.getPage(req.params.slug))));

// ── conversion
router.post('/estimate', validate({ body: estimateSchema }), asyncHandler(async (req, res) => ok(res, await estimate(req.body))));

router.post('/leads', leadLimiter, validate({ body: publicLeadSchema }), asyncHandler(async (req, res) => {
  const lead = await leads.createPublicLead(req.body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  // Never echo internal fields back to an anonymous caller.
  created(res, { id: lead.id, message: 'Thank you. Our team will contact you shortly.' });
}));

// ── customer self-service via single-purpose tokens
router.get('/quotations/:token', validate({ params: tokenParam }), asyncHandler(async (req, res) => ok(res, await quotations.getByPublicToken(req.params.token))));
router.post('/quotations/:token/decide', validate({ params: tokenParam, body: quotationDecisionSchema }), asyncHandler(async (req, res) =>
  ok(res, await quotations.decideByToken(req.params.token, req.body, req.ip))));

router.get('/invoices/:token', validate({ params: tokenParam }), asyncHandler(async (req, res) => ok(res, await invoices.getByPublicToken(req.params.token))));

router.get('/warranties/:token', validate({ params: tokenParam }), asyncHandler(async (req, res) => ok(res, await warranty.getByPublicToken(req.params.token))));
router.post('/warranties/:token/claim', validate({ params: tokenParam, body: warrantyClaimSchema }), asyncHandler(async (req, res) =>
  created(res, await warranty.claimByToken(req.params.token, req.body))));

export default router;
