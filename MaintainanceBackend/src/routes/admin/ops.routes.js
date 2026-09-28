import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { historyRoute } from './historyRoute.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, toPartial } from '../../shared/schemas/common.js';
import * as jobs from '../../services/job.service.js';
import { convertQuotationToJob, jobPlan } from '../../services/handoff.service.js';
import { jobProgress, overPlanWarnings, plannedVsActual } from '../../services/execution.service.js';
import { officeDiary } from '../../services/diary.service.js';
import * as purchases from '../../services/purchase.service.js';
import * as materials from '../../services/material.service.js';
import * as technicians from '../../services/technician.service.js';
import * as s from '../../shared/schemas/ops.js';
import { caseStudySchema } from '../../shared/schemas/cms.js';
import { publishJobAsCaseStudy } from '../../services/casestudy.service.js';
import { mountResource } from './mountResource.js';

const router = Router();
const readJobs = requires('jobs:read');
const writeJobs = requires('jobs:write');
const dispatch = requires('jobs:dispatch');

// ── jobs
router.get('/jobs', readJobs, validate({ query: s.jobListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await jobs.listJobs(req.validatedQuery);
  ok(res, items, meta);
}));

router.get('/dispatch/board', dispatch, validate({ query: s.dispatchQuery }),
  asyncHandler(async (req, res) => ok(res, await jobs.dispatchBoard(req.validatedQuery))));

router.get('/dispatch/unassigned', dispatch, validate({ query: s.unassignedQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await jobs.listUnassigned(req.validatedQuery);
  ok(res, items, meta);
}));

// A job for a quotation is its hand-off (Phase L6) — the same as convert-to-job; any other job is made as asked.
router.post('/jobs', writeJobs, validate({ body: s.jobSchema }),
  asyncHandler(async (req, res) => created(res, req.body.quotationId
    ? await convertQuotationToJob(req.body.quotationId, req.body, req.user.id)
    : await jobs.createJob(req.body, req.user.id))));

router.get('/jobs/:id', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.getJobDetail(req.params.id))));

// The Plan tab (Phase L6): the hand-off checklist — quantities only.
router.get('/jobs/:id/plan', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobPlan(req.params.id))));

// ── execution (Phase L7): the diary, progress with earned value, planned vs actual, variations
router.get('/jobs/:id/diary', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await officeDiary(req.params.id))));
router.get('/jobs/:id/progress', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobProgress(req.params.id, { role: req.user.role }))));
router.get('/jobs/:id/planned-vs-actual', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await plannedVsActual(req.params.id))));
router.get('/jobs/:id/variations', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.jobVariations(req.params.id, { role: req.user.role }))));
router.post('/jobs/:id/purchase-lists/from-shortfall', requires('materials:write'), validate({ params: idParam }),
  asyncHandler(async (req, res) => created(res, await purchases.listFromShortfall(req.params.id, req.user.id))));

// L-D3: go ahead before the advance is paid — a manager's call, with the reason, audited.
router.post('/jobs/:id/advance-override', requires('jobs:advance-override'), validate({ params: idParam, body: s.advanceOverrideSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.overrideAdvance(req.params.id, req.body, req.user.id))));

router.get('/jobs/:id/history', ...historyRoute('Job', 'jobs:history'));

router.post('/jobs/:id/publish-case-study', requires('cms:write'),
  validate({ params: idParam, body: caseStudySchema }),
  asyncHandler(async (req, res) => created(res, await publishJobAsCaseStudy(req.params.id, req.body, req.user.id))));

// What a job cost and its margin: costs:read only (L-D4) — MANAGER and ADMIN.
router.get('/jobs/:id/costing', requires('costs:read'), validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.jobCosting(req.params.id))));

router.put('/jobs/:id', writeJobs, validate({ params: idParam, body: s.jobUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.updateJob(req.params.id, req.body))));

router.patch('/jobs/:id/status', writeJobs, validate({ params: idParam, body: s.jobStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.changeStatus(req.params.id, req.body, req.user.id))));

// The board's drop and its Schedule dialog: window + (optionally) people, in one step.
router.post('/jobs/:id/schedule', dispatch, validate({ params: idParam, body: s.jobScheduleSchema }),
  asyncHandler(async (req, res) => {
    const { job, warnings } = await jobs.scheduleJob(req.params.id, req.body, req.user.id);
    ok(res, job, { warnings });
  }));

router.post('/jobs/:id/assign', dispatch, validate({ params: idParam, body: s.jobAssignSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.assignTechnicians(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/complete', writeJobs, validate({ params: idParam, body: s.jobCompleteSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.completeJob(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/verify', writeJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.verifyJob(req.params.id, req.user.id))));

router.post('/jobs/:id/tasks', writeJobs, validate({ params: idParam, body: s.jobTaskSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addTask(req.params.id, req.body))));
router.patch('/jobs/:id/tasks/:taskId', writeJobs, validate({ params: s.jobTaskParams, body: s.jobTaskUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.updateTask(req.params.id, req.params.taskId, req.body))));
router.delete('/jobs/:id/tasks/:taskId', writeJobs, validate({ params: s.jobTaskParams }),
  asyncHandler(async (req, res) => { await jobs.deleteTask(req.params.id, req.params.taskId); noContent(res); }));

router.post('/jobs/:id/photos', writeJobs, validate({ params: idParam, body: s.jobPhotoSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addPhoto(req.params.id, req.body))));
router.delete('/jobs/:id/photos/:photoId', writeJobs, validate({ params: s.jobPhotoParams }),
  asyncHandler(async (req, res) => { await jobs.deletePhoto(req.params.id, req.params.photoId); noContent(res); }));

router.post('/jobs/:id/materials', writeJobs, validate({ params: idParam, body: s.jobMaterialSchema }),
  asyncHandler(async (req, res) => {
    const line = await jobs.addMaterial(req.params.id, req.body, req.user.id);
    // More than planned is a warning in meta, never a refusal (Phase L7).
    const warnings = await overPlanWarnings(req.params.id, line.materialId);
    created(res, line, warnings.length ? { warnings } : undefined);
  }));
router.delete('/jobs/:id/materials/:jobMaterialId', writeJobs, validate({ params: s.jobMaterialParams }),
  asyncHandler(async (req, res) => { await jobs.removeMaterial(req.params.id, req.params.jobMaterialId, req.user.id); noContent(res); }));

router.post('/jobs/:id/time-logs', writeJobs, validate({ params: idParam, body: s.timeLogCreateSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addTimeLog(req.params.id, req.body))));
router.delete('/jobs/:id/time-logs/:logId', writeJobs, validate({ params: s.jobTimeLogParams }),
  asyncHandler(async (req, res) => { await jobs.removeTimeLog(req.params.id, req.params.logId); noContent(res); }));

router.delete('/jobs/:id', writeJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await jobs.deleteJob(req.params.id); noContent(res); }));

// ── technicians (routes/admin/mountResource.js; the switch is availability)
mountResource(router, 'technicians', technicians, s.technicianSchema, {
  capability: 'technicians',
  // The trail records rate changes, so it is read by the roles that set the rate.
  historyCapability: 'technicians:write',
  query: s.technicianListQuery,
  // The person a profile belongs to is fixed once it exists.
  updateSchema: toPartial(s.technicianSchema).omit({ userId: true }),
  extra: (r, { write }) => {
    r.get('/technicians/users', write, validate({ query: s.linkableUserQuery }), asyncHandler(async (req, res) => {
      const { items, meta } = await technicians.linkableUsers(req.validatedQuery);
      ok(res, items, meta);
    }));
    r.get('/technicians/users/:id', write, validate({ params: idParam }),
      asyncHandler(async (req, res) => ok(res, await technicians.linkableUser(req.params.id))));
  },
});

// ── job templates
mountResource(router, 'job-templates', jobs.jobTemplates, s.jobTemplateSchema, { capability: 'jobs' });

// ── materials & stock
mountResource(router, 'suppliers', materials.suppliers, s.supplierSchema, { capability: 'materials' });
mountResource(router, 'material-categories', materials.materialCategories, s.materialCategorySchema, { capability: 'materials' });
// rates:write reads the catalogue too: a manager writing a recipe picks its materials (Phase L2). The
// material trail stays materials:read — what a reader of the list sees is not its history.
mountResource(router, 'materials', materials.materials, s.materialSchema, {
  capability: 'materials', readAlso: ['rates:write'], historyCapability: 'materials:read',
});

// ── purchase lists (Phase L7): a registry resource with its own moves — DRAFT → ORDERED → RECEIVED | CANCELLED
mountResource(router, 'purchase-lists', purchases.purchaseLists, s.purchaseListSchema, {
  capability: 'materials', query: s.purchaseListListQuery, toggle: false, reorder: false,
  extra: (r, { write }) => {
    r.post('/purchase-lists/:id/order', write, validate({ params: idParam }),
      asyncHandler(async (req, res) => ok(res, await purchases.orderList(req.params.id))));
    r.post('/purchase-lists/:id/receive', write, validate({ params: idParam, body: s.purchaseReceiveSchema }),
      asyncHandler(async (req, res) => ok(res, await purchases.receiveList(req.params.id, req.body, req.user.id))));
    r.post('/purchase-lists/:id/cancel', write, validate({ params: idParam, body: s.purchaseCancelSchema }),
      asyncHandler(async (req, res) => ok(res, await purchases.cancelList(req.params.id, req.body))));
  },
});

const readMat = requires('materials:read');
const writeMat = requires('materials:write');

router.get('/stock', readMat, validate({ query: s.stockQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await materials.stockReport(req.validatedQuery);
  ok(res, items, meta);
}));
router.get('/stock/low', readMat, asyncHandler(async (_req, res) => ok(res, await materials.lowStock())));
router.get('/stock/movements', readMat, validate({ query: s.stockMovementListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await materials.listMovements(req.validatedQuery);
  ok(res, items, meta);
}));
router.post('/stock/movements', writeMat, validate({ body: s.stockMovementSchema }),
  asyncHandler(async (req, res) => created(res, await materials.createMovement(req.body, req.user.id))));

export default router;
