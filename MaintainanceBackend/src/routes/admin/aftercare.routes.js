import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, toPartial } from '../../shared/schemas/common.js';
import * as w from '../../services/warranty.service.js';
import { historyRoute } from './historyRoute.js';
import * as s from '../../shared/schemas/ops.js';

const router = Router();
// Capabilities (Phase I) — the same access the role lists gave: SALES, MANAGER and DISPATCHER read;
// DISPATCHER (and ADMIN) write. ACCOUNTANT holds none of them.
const readWarranties = requires('warranties:read');
const writeWarranties = requires('warranties:write');
const readAmc = requires('amc:read');
const writeAmc = requires('amc:write');
const readReminders = requires('reminders:read');
const writeReminders = requires('reminders:write');

// ── warranties
router.get('/warranties', readWarranties, validate({ query: s.warrantyListQuery }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listWarranties(req.validatedQuery); ok(res, items, meta); }));
router.get('/warranties/expiring', readWarranties, asyncHandler(async (req, res) => ok(res, await w.expiringSoon(Number(req.query.days) || 30))));
router.get('/warranties/:id', readWarranties, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await w.getWarranty(req.params.id))));
router.put('/warranties/:id', writeWarranties, validate({ params: idParam, body: s.warrantyUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await w.updateWarranty(req.params.id, req.body))));
router.get('/warranties/:id/history', ...historyRoute('Warranty', 'warranties:read'));
router.post('/warranties/:id/void', writeWarranties, validate({ params: idParam, body: s.warrantyVoidSchema }),
  asyncHandler(async (req, res) => ok(res, await w.voidWarranty(req.params.id, req.body.reason))));

// ── warranty claims: open first; a decision is taken once
router.get('/warranty-claims', readWarranties, validate({ query: s.warrantyClaimListQuery }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listClaims(req.validatedQuery); ok(res, items, meta); }));
router.get('/warranty-claims/:id', readWarranties, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await w.getClaim(req.params.id))));
router.patch('/warranty-claims/:id', writeWarranties, validate({ params: idParam, body: s.warrantyClaimDecisionSchema }),
  asyncHandler(async (req, res) => ok(res, await w.decideClaim(req.params.id, req.body, req.user.id))));

// ── AMC contracts
router.get('/amc-contracts', readAmc, validate({ query: s.amcContractListQuery }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listContracts(req.validatedQuery); ok(res, items, meta); }));
router.get('/amc-contracts/renewals-due', readAmc,
  asyncHandler(async (req, res) => ok(res, await w.renewalsDue(Number(req.query.days) || 60))));
// The schedule a contract would lay down, before it is saved — exactly what create writes.
router.post('/amc-contracts/preview', writeAmc, validate({ body: s.amcSchedulePreviewSchema }),
  asyncHandler(async (req, res) => ok(res, w.amcSchedule(req.body))));
router.post('/amc-contracts', writeAmc, validate({ body: s.amcContractSchema }),
  asyncHandler(async (req, res) => created(res, await w.createContract(req.body))));
router.get('/amc-contracts/:id', readAmc, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await w.getContract(req.params.id))));
router.get('/amc-contracts/:id/history', ...historyRoute('AmcContract', 'amc:read'));
router.put('/amc-contracts/:id', writeAmc, validate({ params: idParam, body: s.amcContractUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await w.updateContract(req.params.id, req.body))));
router.delete('/amc-contracts/:id', writeAmc, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await w.deleteContract(req.params.id); noContent(res); }));

// ── service reminders
router.get('/service-reminders', readReminders, validate({ query: s.serviceReminderListQuery }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listReminders(req.validatedQuery); ok(res, items, meta); }));
router.post('/service-reminders', writeReminders, validate({ body: s.serviceReminderSchema }),
  asyncHandler(async (req, res) => created(res, await w.createReminder(req.body))));
router.put('/service-reminders/:id', writeReminders, validate({ params: idParam, body: toPartial(s.serviceReminderSchema) }),
  asyncHandler(async (req, res) => ok(res, await w.updateReminder(req.params.id, req.body))));
router.delete('/service-reminders/:id', writeReminders, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await w.deleteReminder(req.params.id); noContent(res); }));

export default router;
