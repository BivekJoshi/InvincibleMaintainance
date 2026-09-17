import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authorize, requires } from '../../middleware/authorize.js';
import { uploadImages, uploadAny } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, toPartial } from '../../shared/schemas/common.js';
import * as media from '../../services/media.service.js';
import * as settings from '../../services/settings.service.js';
import * as audit from '../../services/audit.service.js';
import * as reports from '../../services/report.service.js';
import * as users from '../../services/user.service.js';
import * as messages from '../../services/message.service.js';
import * as notifications from '../../services/notification.service.js';
import { createUserSchema, updateUserSchema, userListQuery } from '../../shared/schemas/auth.js';
import { mediaFolderSchema, mediaUpdateSchema, settingsUpdateSchema } from '../../shared/schemas/cms.js';
import {
  messageDraftPreviewSchema, messageLogQuery, messagePreviewSchema, messageTemplateGroupQuery,
  messageTemplateListQuery, messageTemplateSchema,
} from '../../shared/schemas/ops.js';
import { auditLogQuery, loginActivityQuery, loginSummaryQuery } from '../../shared/schemas/audit.js';
import { historyRoute } from './historyRoute.js';

const router = Router();
const adminOnly = authorize('ADMIN');

// ── dashboard (every role)
router.get('/dashboard', asyncHandler(async (req, res) => ok(res, await reports.dashboard(req.user.role))));

// ── notifications (every role, own only)
router.get('/notifications', asyncHandler(async (req, res) => {
  const { items, unread } = await notifications.listNotifications(req.user.id, { unreadOnly: req.query.unreadOnly === 'true' });
  ok(res, items, { unread });
}));

router.patch('/notifications/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await notifications.markRead(req.user.id, req.params.id);
  noContent(res);
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await notifications.markAllRead(req.user.id);
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
router.post('/media/folders', requires('media:write'), validate({ body: mediaFolderSchema }),
  asyncHandler(async (req, res) => created(res, await media.createFolder(req.body.name, req.body.parentId))));
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

// ── users (ADMIN): accounts, never passwords
router.get('/users', adminOnly, validate({ query: userListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await users.listUsers(req.validatedQuery);
  ok(res, items, meta);
}));

router.post('/users', adminOnly, validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => created(res, await users.createUser(req.body))));

router.get('/users/:id', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.getUser(req.params.id))));

router.put('/users/:id', adminOnly, validate({ params: idParam, body: updateUserSchema }),
  asyncHandler(async (req, res) => ok(res, await users.updateUser(req.params.id, req.body, req.user.id))));

router.patch('/users/:id/toggle', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.toggleUser(req.params.id, req.user.id))));

router.delete('/users/:id', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await users.deleteUser(req.params.id, req.user.id); noContent(res); }));

router.post('/users/:id/send-password-reset', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.sendPasswordReset(req.params.id))));

router.post('/users/:id/unlock', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.unlockUser(req.params.id))));

router.get('/users/:id/sessions', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.listSessions(req.params.id))));

router.delete('/users/:id/sessions', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await users.revokeSessions(req.params.id))));

router.get('/users/:id/history', adminOnly, ...historyRoute('User', 'users:history'));

// ── login activity (ADMIN)
router.get('/login-activity', adminOnly, validate({ query: loginActivityQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await audit.listLoginActivity(req.validatedQuery);
  ok(res, items, meta);
}));

router.get('/login-activity/summary', adminOnly, validate({ query: loginSummaryQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await audit.loginSummary(req.validatedQuery);
  ok(res, items, meta);
}));

// ── audit (ADMIN)
router.get('/audit-logs', adminOnly, validate({ query: auditLogQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await audit.listAuditLogs(req.validatedQuery);
  ok(res, items, meta);
}));

router.get('/audit-logs/models', adminOnly, asyncHandler(async (_req, res) => ok(res, await audit.listAuditModels())));

// ── message templates & delivery logs (ADMIN)
const { templates } = messages;
router.get('/message-templates', adminOnly, validate({ query: messageTemplateListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await templates.list(req.validatedQuery);
  ok(res, items, meta);
}));
router.get('/message-templates/groups', adminOnly, validate({ query: messageTemplateGroupQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await messages.templateGroups(req.validatedQuery);
  ok(res, items, meta);
}));
router.post('/message-templates/preview', adminOnly, validate({ body: messageDraftPreviewSchema }),
  asyncHandler(async (req, res) => ok(res, await messages.previewMessageTemplate(null, req.body))));
router.post('/message-templates', adminOnly, validate({ body: messageTemplateSchema }),
  asyncHandler(async (req, res) => created(res, await templates.create(req.body))));
router.get('/message-templates/:id', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await templates.get(req.params.id))));
router.put('/message-templates/:id', adminOnly, validate({ params: idParam, body: toPartial(messageTemplateSchema) }),
  asyncHandler(async (req, res) => ok(res, await templates.update(req.params.id, req.body))));
router.post('/message-templates/:id/preview', adminOnly, validate({ params: idParam, body: messagePreviewSchema }),
  asyncHandler(async (req, res) => ok(res, await messages.previewMessageTemplate(req.params.id, req.body))));
router.delete('/message-templates/:id', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await templates.remove(req.params.id); noContent(res); }));

router.get('/message-logs', adminOnly, validate({ query: messageLogQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await messages.listMessageLogs(req.validatedQuery);
  ok(res, items, meta);
}));
router.post('/message-logs/:id/retry', adminOnly, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await messages.retryMessage(req.params.id))));

// ── operational reports
router.get('/reports/lead-sources', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.leadSourceReport(req.query))));
router.get('/reports/funnel', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.conversionFunnel(req.query))));
router.get('/reports/sla', requires('reports:sales'), asyncHandler(async (req, res) => ok(res, await reports.slaComplianceReport(req.query))));
router.get('/reports/job-margin', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.jobMarginReport(req.query))));
router.get('/reports/technicians', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.technicianProductivity(req.query))));
router.get('/reports/warranty-claims', requires('reports:ops'), asyncHandler(async (req, res) => ok(res, await reports.warrantyClaimReport(req.query))));

export default router;
