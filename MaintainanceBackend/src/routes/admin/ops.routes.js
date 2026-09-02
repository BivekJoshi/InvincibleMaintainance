import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, reorderBody, toPartial } from '../../shared/schemas/common.js';
import * as jobs from '../../services/job.service.js';
import * as materials from '../../services/material.service.js';
import { makeCrud } from '../../services/crud.service.js';
import { prisma } from '../../lib/prisma.js';
import * as s from '../../shared/schemas/ops.js';

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

router.get('/dispatch/unassigned', dispatch, asyncHandler(async (_req, res) => {
  const { items } = await jobs.listJobs({ unassigned: true, limit: 100 });
  ok(res, items);
}));

router.post('/jobs', writeJobs, validate({ body: s.jobSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.createJob(req.body, req.user.id))));

router.get('/jobs/:id', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.getJob(req.params.id))));

router.get('/jobs/:id/costing', readJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.jobCosting(req.params.id))));

router.put('/jobs/:id', writeJobs, validate({ params: idParam, body: s.jobUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.updateJob(req.params.id, req.body))));

router.patch('/jobs/:id/status', writeJobs, validate({ params: idParam, body: s.jobStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.changeStatus(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/assign', dispatch, validate({ params: idParam, body: s.jobAssignSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.assignTechnicians(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/complete', writeJobs, validate({ params: idParam, body: s.jobCompleteSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.completeJob(req.params.id, req.body, req.user.id))));

router.post('/jobs/:id/verify', writeJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await jobs.verifyJob(req.params.id, req.user.id))));

router.post('/jobs/:id/tasks', writeJobs, validate({ params: idParam, body: s.jobTaskSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addTask(req.params.id, req.body))));
router.patch('/jobs/:id/tasks/:taskId', writeJobs, validate({ body: s.jobTaskUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await jobs.updateTask(req.params.id, req.params.taskId, req.body))));
router.delete('/jobs/:id/tasks/:taskId', writeJobs,
  asyncHandler(async (req, res) => { await jobs.deleteTask(req.params.id, req.params.taskId); noContent(res); }));

router.post('/jobs/:id/photos', writeJobs, validate({ params: idParam, body: s.jobPhotoSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addPhoto(req.params.id, req.body))));
router.delete('/jobs/:id/photos/:photoId', writeJobs,
  asyncHandler(async (req, res) => { await jobs.deletePhoto(req.params.id, req.params.photoId); noContent(res); }));

router.post('/jobs/:id/materials', writeJobs, validate({ params: idParam, body: s.jobMaterialSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.addMaterial(req.params.id, req.body, req.user.id))));
router.delete('/jobs/:id/materials/:jobMaterialId', writeJobs,
  asyncHandler(async (req, res) => { await jobs.removeMaterial(req.params.id, req.params.jobMaterialId, req.user.id); noContent(res); }));

router.delete('/jobs/:id', writeJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await jobs.deleteJob(req.params.id); noContent(res); }));

// ── technicians
const readTech = requires('technicians:read');
const writeTech = requires('technicians:write');

router.get('/technicians', readTech, asyncHandler(async (_req, res) => ok(res, await prisma.technician.findMany({
  where: { deletedAt: null },
  include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
  orderBy: { employeeCode: 'asc' },
}))));

router.post('/technicians', writeTech, validate({ body: s.technicianSchema }),
  asyncHandler(async (req, res) => created(res, await prisma.technician.create({
    data: { ...req.body, hourlyRate: req.body.hourlyRate != null ? Math.round(req.body.hourlyRate * 100) : null },
    include: { user: { select: { id: true, name: true } } },
  }))));

router.put('/technicians/:id', writeTech, validate({ params: idParam, body: toPartial(s.technicianSchema) }),
  asyncHandler(async (req, res) => ok(res, await prisma.technician.update({
    where: { id: req.params.id },
    data: { ...req.body, ...(req.body.hourlyRate != null ? { hourlyRate: Math.round(req.body.hourlyRate * 100) } : {}) },
    include: { user: { select: { id: true, name: true } } },
  }))));

router.delete('/technicians/:id', writeTech, validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await prisma.technician.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    noContent(res);
  }));

// ── job templates
const templates = makeCrud({ model: 'jobTemplate', label: 'Job template', searchFields: ['name'], sortable: false, defaultSort: 'name' });
router.get('/job-templates', readJobs, asyncHandler(async (req, res) => {
  const { items, meta } = await templates.list(req.query); ok(res, items, meta);
}));
router.post('/job-templates', writeJobs, validate({ body: s.jobTemplateSchema }),
  asyncHandler(async (req, res) => created(res, await templates.create(req.body))));
router.put('/job-templates/:id', writeJobs, validate({ params: idParam, body: toPartial(s.jobTemplateSchema) }),
  asyncHandler(async (req, res) => ok(res, await templates.update(req.params.id, req.body))));
router.delete('/job-templates/:id', writeJobs, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await templates.remove(req.params.id); noContent(res); }));

// ── materials & stock
const readMat = requires('materials:read');
const writeMat = requires('materials:write');

function mountSimple(path, service, schema) {
  router.get(`/${path}`, readMat, validate({ query: listQuery.passthrough() }),
    asyncHandler(async (req, res) => { const { items, meta } = await service.list(req.query); ok(res, items, meta); }));
  router.post(`/${path}`, writeMat, validate({ body: schema }),
    asyncHandler(async (req, res) => created(res, await service.create(req.body))));
  router.get(`/${path}/:id`, readMat, validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.get(req.params.id))));
  router.put(`/${path}/:id`, writeMat, validate({ params: idParam, body: toPartial(schema) }),
    asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body))));
  router.delete(`/${path}/:id`, writeMat, validate({ params: idParam }),
    asyncHandler(async (req, res) => { await service.remove(req.params.id); noContent(res); }));
  router.patch(`/${path}/reorder`, writeMat, validate({ body: reorderBody }),
    asyncHandler(async (req, res) => { await service.reorder(req.body.items); noContent(res); }));
}

mountSimple('suppliers', materials.suppliers, s.supplierSchema);
mountSimple('material-categories', materials.materialCategories, s.materialCategorySchema);
mountSimple('materials', materials.materials, s.materialSchema);

router.get('/stock', readMat, asyncHandler(async (req, res) => ok(res, await materials.stockReport(req.query))));
router.get('/stock/low', readMat, asyncHandler(async (_req, res) => ok(res, await materials.lowStock())));
router.get('/stock/movements', readMat, asyncHandler(async (req, res) => ok(res, await materials.listMovements(req.query))));
router.post('/stock/movements', writeMat, validate({ body: s.stockMovementSchema }),
  asyncHandler(async (req, res) => created(res, await materials.createMovement(req.body, req.user.id))));

export default router;
