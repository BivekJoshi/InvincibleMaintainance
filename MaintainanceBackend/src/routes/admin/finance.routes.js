import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { historyRoute } from './historyRoute.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, toPartial } from '../../shared/schemas/common.js';
import * as invoices from '../../services/invoice.service.js';
import * as reports from '../../services/report.service.js';
import * as s from '../../shared/schemas/ops.js';

const router = Router();
const readInv = requires('invoices:read');
const writeInv = requires('invoices:write');

router.get('/invoices', readInv, validate({ query: s.invoiceListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await invoices.listInvoices(req.validatedQuery);
  ok(res, items, meta);
}));

router.post('/invoices', writeInv, validate({ body: s.invoiceSchema }),
  asyncHandler(async (req, res) => created(res, await invoices.createInvoice(req.body))));

router.post('/invoices/from-job/:jobId', writeInv, validate({ body: s.invoiceFromJobSchema }),
  asyncHandler(async (req, res) => created(res, await invoices.createFromJob(req.params.jobId, req.body))));

router.get('/invoices/:id', readInv, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await invoices.getInvoice(req.params.id))));

router.get('/invoices/:id/history', ...historyRoute('Invoice', 'invoices:history'));

router.put('/invoices/:id', writeInv, validate({ params: idParam, body: s.invoiceUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.updateInvoice(req.params.id, req.body))));

router.post('/invoices/:id/send', writeInv, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await invoices.sendInvoice(req.params.id))));

router.post('/invoices/:id/void', writeInv, validate({ params: idParam, body: s.invoiceVoidSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.voidInvoice(req.params.id, req.body.reason))));

router.post('/invoices/:id/payments', requires('payments:write'), validate({ params: idParam, body: s.paymentSchema }),
  asyncHandler(async (req, res) => created(res, await invoices.recordPayment(req.params.id, req.body, req.user.id))));

// Payments are voided, never deleted: the row stays, flagged, and the paid total ignores it.
router.post('/invoices/:id/payments/:paymentId/void', requires('payments:write'),
  validate({ params: s.paymentParams, body: s.paymentVoidSchema }),
  asyncHandler(async (req, res) => ok(res, await invoices.voidPayment(req.params.id, req.params.paymentId, req.body.reason, req.user.id))));

router.get('/payments', requires('payments:read'), validate({ query: s.paymentListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await invoices.listPayments(req.validatedQuery);
  ok(res, items, meta);
}));

// ── expenses
router.get('/expenses', requires('expenses:read'), validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await invoices.expenses.list(req.query); ok(res, items, meta); }));
router.get('/expenses/:id', requires('expenses:read'), validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await invoices.expenses.get(req.params.id))));
router.post('/expenses', requires('expenses:write'), validate({ body: s.expenseSchema }),
  asyncHandler(async (req, res) => created(res, await invoices.expenses.create(req.body, req.user.id))));
router.put('/expenses/:id', requires('expenses:write'), validate({ params: idParam, body: toPartial(s.expenseSchema) }),
  asyncHandler(async (req, res) => ok(res, await invoices.expenses.update(req.params.id, req.body))));
router.delete('/expenses/:id', requires('expenses:write'), validate({ params: idParam }),
  asyncHandler(async (req, res) => { await invoices.expenses.remove(req.params.id); noContent(res); }));

// ── reports
const readReports = requires('reports:finance');
router.get('/reports/aging', readReports, asyncHandler(async (_req, res) => ok(res, await reports.agingReport())));
router.get('/reports/revenue', readReports, asyncHandler(async (req, res) => ok(res, await reports.revenueReport(req.query))));
router.get('/reports/collections', readReports, asyncHandler(async (req, res) => ok(res, await reports.collectionsReport(req.query))));
router.get('/customers/:id/statement', readReports, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await reports.customerStatement(req.params.id))));

export default router;
