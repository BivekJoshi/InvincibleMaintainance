import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam } from '../../shared/schemas/common.js';
import * as surveys from '../../services/survey.service.js';
import * as s from '../../shared/schemas/survey.js';

const router = Router();

const readSurveys = requires('surveys:read');
const writeSurveys = requires('surveys:write');
// Deliberately a different capability: DISPATCHER may read a survey but must not
// see what it costs. The split here is the money wall.
const readPricing = requires('quotations:read');
const writeQuotations = requires('quotations:write');

router.get('/surveys', readSurveys, validate({ query: s.surveyListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await surveys.listSurveys(req.validatedQuery);
  ok(res, items, meta);
}));

router.get('/surveys/:id', readSurveys, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await surveys.getSurvey(req.params.id))));

router.get('/surveys/:id/pricing', readPricing, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await surveys.priceSurvey(req.params.id))));

router.patch('/surveys/:id/review', writeSurveys,
  validate({ params: idParam, body: s.surveyReviewSchema }),
  asyncHandler(async (req, res) => ok(res, await surveys.reviewSurvey(req.params.id, req.body, req.user.id))));

router.post('/surveys/:id/quotation', writeQuotations,
  validate({ params: idParam, body: s.surveyQuotationSchema }),
  asyncHandler(async (req, res) =>
    created(res, await surveys.buildQuotationFromSurvey(req.params.id, req.body, req.user.id))));

router.delete('/surveys/:id', writeSurveys, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await surveys.deleteSurvey(req.params.id);
  noContent(res);
}));

export default router;
