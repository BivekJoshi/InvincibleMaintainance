import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authorize } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, toPartial } from '../../shared/schemas/common.js';
import * as w from '../../services/warranty.service.js';
import * as s from '../../shared/schemas/ops.js';

const router = Router();
const staff = authorize('ADMIN', 'DISPATCHER', 'SALES', 'MANAGER');
const manage = authorize('ADMIN', 'DISPATCHER');

router.get('/warranties', staff, validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listWarranties(req.query); ok(res, items, meta); }));
router.get('/warranties/expiring', staff, asyncHandler(async (req, res) => ok(res, await w.expiringSoon(Number(req.query.days) || 30))));
router.get('/warranties/:id', staff, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await w.getWarranty(req.params.id))));
router.put('/warranties/:id', manage, validate({ params: idParam, body: s.warrantyUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await w.updateWarranty(req.params.id, req.body))));

router.get('/warranty-claims', staff, validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listClaims(req.query); ok(res, items, meta); }));
router.patch('/warranty-claims/:id', manage, validate({ params: idParam, body: s.warrantyClaimDecisionSchema }),
  asyncHandler(async (req, res) => ok(res, await w.decideClaim(req.params.id, req.body, req.user.id))));

router.get('/amc-contracts', staff, validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listContracts(req.query); ok(res, items, meta); }));
router.get('/amc-contracts/renewals-due', staff,
  asyncHandler(async (req, res) => ok(res, await w.renewalsDue(Number(req.query.days) || 60))));
router.post('/amc-contracts', manage, validate({ body: s.amcContractSchema }),
  asyncHandler(async (req, res) => created(res, await w.createContract(req.body))));
router.get('/amc-contracts/:id', staff, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await w.getContract(req.params.id))));
router.put('/amc-contracts/:id', manage, validate({ params: idParam, body: toPartial(s.amcContractSchema) }),
  asyncHandler(async (req, res) => ok(res, await w.updateContract(req.params.id, req.body))));
router.delete('/amc-contracts/:id', manage, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await w.deleteContract(req.params.id); noContent(res); }));

router.get('/service-reminders', staff, validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await w.listReminders(req.query); ok(res, items, meta); }));
router.post('/service-reminders', manage, validate({ body: s.serviceReminderSchema }),
  asyncHandler(async (req, res) => created(res, await w.createReminder(req.body))));
router.put('/service-reminders/:id', manage, validate({ params: idParam, body: toPartial(s.serviceReminderSchema) }),
  asyncHandler(async (req, res) => ok(res, await w.updateReminder(req.params.id, req.body))));
router.delete('/service-reminders/:id', manage, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await w.deleteReminder(req.params.id); noContent(res); }));

export default router;
