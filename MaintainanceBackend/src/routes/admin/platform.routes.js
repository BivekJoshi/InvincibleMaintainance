import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authorize, requires } from '../../middleware/authorize.js';
import { uploadImages, uploadAny } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, toPartial } from '../../shared/schemas/common.js';
import { prisma } from '../../lib/prisma.js';
import { notFound, badRequest } from '../../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../../utils/pagination.js';
import * as media from '../../services/media.service.js';
import * as settings from '../../services/settings.service.js';
import * as audit from '../../services/audit.service.js';
import * as reports from '../../services/report.service.js';
import { hashPassword } from '../../services/auth.service.js';
import { createUserSchema, updateUserSchema } from '../../shared/schemas/auth.js';
import { mediaUpdateSchema, settingsUpdateSchema } from '../../shared/schemas/cms.js';
import { messageTemplateSchema } from '../../shared/schemas/ops.js';
import { makeCrud } from '../../services/crud.service.js';

const router = Router();
const adminOnly = authorize('ADMIN');

// ── dashboard (every role)
router.get('/dashboard', asyncHandler(async (req, res) => ok(res, await reports.dashboard(req.user.role))));

// ── notifications (every role, own only)
router.get('/notifications', asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.id, ...(req.query.unreadOnly === 'true' ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  ok(res, items, { unread });
}));

router.patch('/notifications/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id }, data: { readAt: new Date() },
  });
  if (!count) throw notFound('Notification');
  noContent(res);
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  noContent(res);
}));

// ── media
router.get('/media', requires('media:read'), validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta: m } = await media.listMedia(req.query); ok(res, items, m); }));

router.post('/media', requires('media:write'), uploadLimiter, uploadImages.array('files', 20),
  asyncHandler(async (req, res) => created(res, await media.uploadFiles(req.files, {
    folderId: req.body.folderId || null, uploadedBy: req.user.id, alt: req.body.alt,
  }))));

router.post('/media/documents', requires('media:write'), uploadLimiter, uploadAny.array('files', 10),
  asyncHandler(async (req, res) => created(res, await media.uploadFiles(req.files, {
    folderId: req.body.folderId || null, uploadedBy: req.user.id,
  }))));

router.get('/media/folders', requires('media:read'), asyncHandler(async (_req, res) => ok(res, await media.listFolders())));
router.post('/media/folders', requires('media:write'), asyncHandler(async (req, res) => {
  if (!req.body?.name) throw badRequest('Folder name is required');
  created(res, await media.createFolder(req.body.name, req.body.parentId));
}));
router.delete('/media/folders/:id', requires('media:write'), validate({ params: idParam }),
  asyncHandler(async (req, res) => { await media.deleteFolder(req.params.id); noContent(res); }));

router.get('/media/:id', requires('media:read'), validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await media.getMedia(req.params.id))));
router.put('/media/:id', requires('media:write'), validate({ params: idParam, body: mediaUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await media.updateMedia(req.params.id, req.body))));
router.delete('/media/:id', requires('media:write'), validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await media.deleteMedia(req.params.id, { hard: req.query.hard === 'true', role: req.user.role });
    noContent(res);
  }));

// ── settings
router.get('/settings', requires('settings:read'), asyncHandler(async (_req, res) => ok(res, await settings.groupedSettings())));
router.patch('/settings', adminOnly, validate({ body: settingsUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await settings.updateSettings(req.body.values))));

// ── users
router.get('/users', adminOnly, validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(req.validatedQuery);
  const where = { deletedAt: null, ...(q ? { OR: searchOr(q, ['name', 'email', 'phone']) } : {}) };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy, skip, take,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ]);
  ok(res, items, meta({ page, limit, total }));
}));

router.post('/users', adminOnly, validate({ body: createUserSchema }), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const user = await prisma.user.create({
    data: { ...rest, email: rest.email.toLowerCase(), passwordHash: await hashPassword(password) },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  created(res, user);
}));

router.put('/users/:id', adminOnly, validate({ params: idParam, body: updateUserSchema }), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(rest.email ? { email: rest.email.toLowerCase() } : {}),
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  ok(res, user);
}));

router.patch('/users/:id/toggle', adminOnly, validate({ params: idParam }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!user) throw notFound('User');
  if (user.id === req.user.id) throw badRequest('You cannot disable your own account');
  ok(res, await prisma.user.update({
    where: { id: user.id }, data: { isActive: !user.isActive },
    select: { id: true, name: true, isActive: true },
  }));
}));

router.delete('/users/:id', adminOnly, validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw badRequest('You cannot delete your own account');
  await prisma.user.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
  noContent(res);
}));

// ── audit
router.get('/audit-logs', adminOnly, asyncHandler(async (req, res) => {
  const { items, meta: m } = await audit.listAuditLogs(req.query);
  ok(res, items, m);
}));

// ── message templates & logs
const templates = makeCrud({ model: 'messageTemplate', label: 'Message template', searchFields: ['key', 'body'], softDelete: false, sortable: false, defaultSort: 'key' });
router.get('/message-templates', adminOnly, asyncHandler(async (req, res) => {
  const { items, meta: m } = await templates.list(req.query); ok(res, items, m);
}));
router.post('/message-templates', adminOnly, validate({ body: messageTemplateSchema }),
  asyncHandler(async (req, res) => created(res, await templates.create(req.body))));
router.put('/message-templates/:id', adminOnly, validate({ params: idParam, body: toPartial(messageTemplateSchema) }),
  asyncHandler(async (req, res) => ok(res, await templates.update(req.params.id, req.body))));
router.delete('/message-templates/:id', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await templates.remove(req.params.id); noContent(res); }));

router.get('/message-logs', adminOnly, asyncHandler(async (req, res) => {
  const { page, limit, skip, take, orderBy } = parseListQuery(req.query);
  const where = { ...(req.query.status ? { status: req.query.status } : {}), ...(req.query.channel ? { channel: req.query.channel } : {}) };
  const [items, total] = await Promise.all([
    prisma.messageLog.findMany({ where, orderBy, skip, take }),
    prisma.messageLog.count({ where }),
  ]);
  ok(res, items, meta({ page, limit, total }));
}));

// ── operational reports
router.get('/reports/lead-sources', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.leadSourceReport(req.query))));
router.get('/reports/funnel', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.conversionFunnel(req.query))));
router.get('/reports/sla', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.slaComplianceReport(req.query))));
router.get('/reports/job-margin', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.jobMarginReport(req.query))));
router.get('/reports/technicians', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.technicianProductivity(req.query))));
router.get('/reports/warranty-claims', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.warrantyClaimReport(req.query))));

export default router;
