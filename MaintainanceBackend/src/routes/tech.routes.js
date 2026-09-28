import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadImages } from '../middleware/upload.js';
import { ok, created } from '../utils/response.js';
import { idParam } from '../shared/schemas/common.js';
import * as jobs from '../services/job.service.js';
import * as media from '../services/media.service.js';
import * as surveys from '../services/survey.service.js';
import { badRequest, forbidden } from '../utils/AppError.js';
import * as s from '../shared/schemas/ops.js';
import * as sv from '../shared/schemas/survey.js';
import * as materials from '../services/material.service.js';
import * as technicians from '../services/technician.service.js';
import * as rateLibrary from '../services/rateLibrary.service.js';
import { applySync } from '../services/techSync.service.js';
import { overPlanWarnings } from '../services/execution.service.js';
import * as diary from '../services/diary.service.js';
import { FIELD_ROLES } from '../shared/enums.js';
import { can } from '../shared/permissions.js';
import { fieldSafe } from '../utils/moneyWall.js';

const router = Router();

// Every route below is scoped to the caller's own technician profile.
router.use(authorize(...FIELD_ROLES, 'ADMIN', 'DISPATCHER'));

// The money wall: every field response leaves without a price, cost, total or anyone's pay.
router.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(body?.data === undefined ? body : { ...body, data: fieldSafe(body.data) });
  next();
});

/**
 * Resolves the technician whose queue this request acts on.
 *
 * A field role (TECHNICIAN, SURVEYOR) always acts as themselves. An ADMIN or
 * DISPATCHER has no technician profile of their own, so they may inspect a
 * technician's queue by passing ?technicianId= — used by the dispatch board's
 * "view as" preview. Without one they simply have an empty queue rather than a 500.
 */
router.use(asyncHandler(async (req, _res, next) => {
  if (FIELD_ROLES.includes(req.user.role)) {
    req.technician = await jobs.technicianForUser(req.user.id);
    return next();
  }
  req.technician = await technicians.technicianForViewer(req.user.id, req.query.technicianId);
  next();
}));

/** Routes that need a concrete technician (timers, sync) rather than a viewer. */
const requireTechnician = (req, _res, next) => {
  if (!req.technician) {
    return next(badRequest(
      'Your account is not linked to a technician profile. Pass ?technicianId= to act on behalf of one.',
    ));
  }
  next();
};

/**
 * Guards a job route so a field user can only touch their own assignments.
 * Must test membership of FIELD_ROLES, not equality with one role — an exact
 * match here silently exempts every other field role from the ownership check.
 */
const own = asyncHandler(async (req, _res, next) => {
  if (!FIELD_ROLES.includes(req.user.role)) return next();
  await jobs.assertAssigned(req.params.id, req.technician.id);
  next();
});

/** The survey equivalent of `own` — a field user only reads their own surveys. */
const ownSurvey = asyncHandler(async (req, _res, next) => {
  if (!FIELD_ROLES.includes(req.user.role)) return next();
  await surveys.assertOwnSurvey(req.params.id, req.technician.id);
  next();
});

/**
 * Writing a survey through the field app.
 *
 * `own` can wave ADMIN and DISPATCHER through because both hold jobs:write, so
 * skipping the assignment check costs nothing. Surveys are different: DISPATCHER
 * holds surveys:read but NOT surveys:write, so the same shape would have let them
 * edit and submit any survey here — the exact wall /admin/surveys enforces.
 * A non-field caller must therefore hold the write capability.
 */
const writeSurvey = asyncHandler(async (req, _res, next) => {
  if (FIELD_ROLES.includes(req.user.role)) {
    await surveys.assertOwnSurvey(req.params.id, req.technician.id);
    return next();
  }
  if (!can(req.user.role, 'surveys:write')) {
    return next(forbidden('You can read surveys but not change them'));
  }
  next();
});

router.get('/jobs/today', asyncHandler(async (req, res) =>
  ok(res, req.technician ? await jobs.myJobsToday(req.technician.id) : [])));

router.get('/jobs', asyncHandler(async (req, res) =>
  ok(res, req.technician ? await jobs.myJobs(req.technician.id, req.query) : [])));

router.get('/jobs/:id', validate({ params: idParam }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.getFieldJob(req.params.id))));

router.patch('/jobs/:id/status', validate({ params: idParam, body: s.jobStatusSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.changeStatus(req.params.id, req.body, req.user.id))));

router.patch('/jobs/:id/tasks/:taskId', validate({ body: s.jobTaskUpdateSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.updateTask(req.params.id, req.params.taskId, req.body))));

router.post('/jobs/:id/photos', validate({ params: idParam }), own, uploadImages.array('files', 10),
  asyncHandler(async (req, res) => {
    const uploaded = await media.uploadFiles(req.files, { uploadedBy: req.user.id });
    const kind = s.jobPhotoSchema.shape.kind.parse(req.body.kind ?? 'DURING');
    const rows = [];
    for (const m of uploaded) {
      rows.push(await jobs.addPhoto(req.params.id, { mediaId: m.id, kind, caption: req.body.caption }));
    }
    created(res, { photos: rows, media: uploaded });
  }));

router.post('/jobs/:id/materials', validate({ params: idParam, body: s.jobMaterialSchema }), own,
  asyncHandler(async (req, res) => {
    const line = await jobs.addMaterial(req.params.id, req.body, req.user.id);
    const warnings = await overPlanWarnings(req.params.id, line.materialId);
    created(res, line, warnings.length ? { warnings } : undefined);
  }));

router.post('/jobs/:id/time/start', requireTechnician, validate({ params: idParam, body: s.timeLogStartSchema }), own,
  asyncHandler(async (req, res) => created(res, await jobs.startTimer(req.params.id, req.technician.id, req.body.note))));

router.post('/jobs/:id/time/stop', requireTechnician, validate({ params: idParam, body: s.timeLogStopSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.stopTimer(req.params.id, req.technician.id, req.body.note))));

router.post('/jobs/:id/complete', validate({ params: idParam, body: s.jobCompleteSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.completeJob(req.params.id, req.body, req.user.id))));

// ── the site diary (Phase L7): one entry per job per Kathmandu day, a full replace, no money

router.get('/jobs/:id/diary', validate({ params: idParam }), own,
  asyncHandler(async (req, res) => ok(res, await diary.diaryDays(req.params.id))));

router.get('/jobs/:id/diary/:day', validate({ params: s.diaryParams }), own,
  asyncHandler(async (req, res) => ok(res, await diary.getDiaryDay(req.params.id, req.params.day))));

router.put('/jobs/:id/diary/:day', validate({ params: s.diaryParams, body: s.diarySchema }), own,
  asyncHandler(async (req, res) => ok(res, await diary.saveDiary(req.params.id, req.params.day, req.body, req.user.id))));

// ── site surveys

router.get('/surveys', asyncHandler(async (req, res) =>
  ok(res, req.technician ? await surveys.mySurveys(req.technician.id, req.query) : [])));

router.get('/surveys/:id', validate({ params: idParam }), ownSurvey,
  asyncHandler(async (req, res) => ok(res, await surveys.getSurvey(req.params.id, { field: true }))));

/** Create-or-return, so an offline device firing this twice is harmless. */
router.post('/jobs/:id/survey', validate({ params: idParam, body: sv.surveyCreateSchema }), own,
  asyncHandler(async (req, res) => {
    const { survey, created: isNew } = await surveys.createFromJob(
      req.params.id,
      { surveyorId: req.body.surveyorId ?? req.technician?.id },
      req.user.id,
    );
    const full = await surveys.getSurvey(survey.id, { field: true });
    return isNew ? created(res, full) : ok(res, full);
  }));

router.put('/surveys/:id', validate({ params: idParam, body: sv.surveySaveSchema }), writeSurvey,
  asyncHandler(async (req, res) =>
    ok(res, await surveys.saveDraft(req.params.id, req.body, { userId: req.user.id }))));

router.post('/surveys/:id/submit', validate({ params: idParam, body: sv.surveySubmitSchema }), writeSurvey,
  asyncHandler(async (req, res) => {
    await surveys.submitSurvey(req.params.id, req.body, { userId: req.user.id });
    ok(res, await surveys.getSurvey(req.params.id, { field: true }));
  }));

/**
 * Survey evidence is a JobPhoto on the parent inspection job: ISSUE, or SKETCH for a photo of a paper
 * sketch, with the room or area it shows (Phase L5). Append-only, like the upload queue that sends it.
 */
router.post('/surveys/:id/photos', validate({ params: idParam }), writeSurvey, uploadImages.array('files', 10),
  asyncHandler(async (req, res) => {
    // Multipart fields arrive after validate() has run, so they are checked here.
    const parsed = sv.surveyPhotoFields.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw badRequest('Check the photo details', parsed.error.issues.map((i) => ({ path: i.path, message: i.message })));
    }
    const fields = parsed.data;
    const survey = await surveys.getSurvey(req.params.id, { field: true });
    const uploaded = await media.uploadFiles(req.files, { uploadedBy: req.user.id });
    const rows = [];
    for (const m of uploaded) {
      rows.push(await jobs.addPhoto(survey.job.id, { mediaId: m.id, kind: fields.kind, caption: fields.caption, area: fields.area }));
    }
    created(res, { photos: rows, media: uploaded });
  }));

/** Reference data the offline app caches on login. Deliberately no rates: the
 *  field reports quantities, the office attaches price. */
router.get('/materials', asyncHandler(async (_req, res) => ok(res, await materials.fieldMaterials())));

router.get('/rate-card', asyncHandler(async (_req, res) => ok(res, await rateLibrary.fieldRateCard())));

// ── offline sync

/** Replays the queue an offline device built up — applied in order, each key at most once (techSync.service). */
router.post('/sync', requireTechnician, validate({ body: s.techSyncSchema }), asyncHandler(async (req, res) =>
  ok(res, await applySync(req.body.mutations, { user: req.user, technician: req.technician }))));

export default router;
