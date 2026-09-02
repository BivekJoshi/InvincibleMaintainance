import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadImages } from '../middleware/upload.js';
import { ok, created } from '../utils/response.js';
import { idParam } from '../shared/schemas/common.js';
import * as jobs from '../services/job.service.js';
import * as media from '../services/media.service.js';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import * as s from '../shared/schemas/ops.js';

const router = Router();

// Every route below is scoped to the caller's own technician profile.
router.use(authorize('TECHNICIAN', 'ADMIN', 'DISPATCHER'));

/**
 * Resolves the technician whose queue this request acts on.
 *
 * A TECHNICIAN always acts as themselves. An ADMIN or DISPATCHER has no
 * technician profile of their own, so they may inspect a technician's queue by
 * passing ?technicianId= — used by the dispatch board's "view as" preview.
 * Without one they simply have an empty queue rather than a 500.
 */
router.use(asyncHandler(async (req, _res, next) => {
  if (req.user.role === 'TECHNICIAN') {
    req.technician = await jobs.technicianForUser(req.user.id);
    return next();
  }
  const id = req.query.technicianId;
  req.technician = id
    ? await prisma.technician.findFirst({ where: { id, deletedAt: null } })
    : await prisma.technician.findFirst({ where: { userId: req.user.id, deletedAt: null } });
  if (id && !req.technician) throw notFound('Technician');
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

/** Guards a job route so a technician can only touch their own assignments. */
const own = asyncHandler(async (req, _res, next) => {
  if (req.user.role !== 'TECHNICIAN') return next();
  await jobs.assertAssigned(req.params.id, req.technician.id);
  next();
});

router.get('/jobs/today', asyncHandler(async (req, res) =>
  ok(res, req.technician ? await jobs.myJobsToday(req.technician.id) : [])));

router.get('/jobs', asyncHandler(async (req, res) =>
  ok(res, req.technician ? await jobs.myJobs(req.technician.id, req.query) : [])));

router.get('/jobs/:id', validate({ params: idParam }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.getJob(req.params.id))));

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
  asyncHandler(async (req, res) => created(res, await jobs.addMaterial(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/time/start', requireTechnician, validate({ params: idParam, body: s.timeLogStartSchema }), own,
  asyncHandler(async (req, res) => created(res, await jobs.startTimer(req.params.id, req.technician.id, req.body.note))));

router.post('/jobs/:id/time/stop', requireTechnician, validate({ params: idParam, body: s.timeLogStopSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.stopTimer(req.params.id, req.technician.id, req.body.note))));

router.post('/jobs/:id/complete', validate({ params: idParam, body: s.jobCompleteSchema }), own,
  asyncHandler(async (req, res) => ok(res, await jobs.completeJob(req.params.id, req.body, req.user.id))));

/** Reference data the offline app caches on login. */
router.get('/materials', asyncHandler(async (_req, res) => ok(res, await prisma.material.findMany({
  where: { isActive: true, deletedAt: null },
  select: { id: true, code: true, name: true, unit: true, sellRate: true },
  orderBy: { name: 'asc' },
}))));

// ── offline sync

const syncSchema = z.object({
  mutations: z.array(z.object({
    idempotencyKey: z.string().min(8).max(80),
    at: z.coerce.date(),
    kind: z.enum(['status', 'task', 'material', 'time_start', 'time_stop', 'complete']),
    jobId: z.string().min(1),
    taskId: z.string().optional(),
    payload: z.record(z.any()).default({}),
  })).min(1).max(200),
});

/**
 * Replays the queue an offline device built up. Idempotency keys make a repeated
 * send harmless, and mutations are applied in the order the technician made them.
 */
router.post('/sync', requireTechnician, validate({ body: syncSchema }), asyncHandler(async (req, res) => {
  const results = [];
  const ordered = [...req.body.mutations].sort((a, b) => new Date(a.at) - new Date(b.at));

  for (const m of ordered) {
    const seen = await prisma.auditLog.findFirst({
      where: { model: 'TechSync', recordId: m.idempotencyKey }, select: { id: true },
    });
    if (seen) {
      results.push({ idempotencyKey: m.idempotencyKey, status: 'duplicate' });
      continue;
    }
    try {
      if (req.user.role === 'TECHNICIAN') await jobs.assertAssigned(m.jobId, req.technician.id);

      switch (m.kind) {
        case 'status':
          await jobs.changeStatus(m.jobId, s.jobStatusSchema.parse(m.payload), req.user.id);
          break;
        case 'task':
          await jobs.updateTask(m.jobId, m.taskId, s.jobTaskUpdateSchema.parse(m.payload));
          break;
        case 'material':
          await jobs.addMaterial(m.jobId, s.jobMaterialSchema.parse(m.payload), req.user.id);
          break;
        case 'time_start':
          await jobs.startTimer(m.jobId, req.technician.id, m.payload.note);
          break;
        case 'time_stop':
          await jobs.stopTimer(m.jobId, req.technician.id, m.payload.note);
          break;
        case 'complete':
          await jobs.completeJob(m.jobId, s.jobCompleteSchema.parse(m.payload), req.user.id);
          break;
        default:
          throw badRequest(`Unknown mutation kind: ${m.kind}`);
      }
      await prisma.auditLog.create({
        data: { actorId: req.user.id, action: 'sync', model: 'TechSync', recordId: m.idempotencyKey, changes: { kind: m.kind, jobId: m.jobId } },
      });
      results.push({ idempotencyKey: m.idempotencyKey, status: 'applied' });
    } catch (err) {
      logger.warn({ err: err.message, mutation: m.kind, jobId: m.jobId }, 'sync mutation rejected');
      results.push({ idempotencyKey: m.idempotencyKey, status: 'failed', error: err.message, code: err.code ?? 'SYNC_FAILED' });
    }
  }

  ok(res, {
    results,
    applied: results.filter((r) => r.status === 'applied').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    failed: results.filter((r) => r.status === 'failed').length,
  });
}));

export default router;
