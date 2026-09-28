import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { historyRoute } from './historyRoute.js';
import { mountResource } from './mountResource.js';
import { uploadImages } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { reportRoute } from './reportRoute.js';
import { ok, created } from '../../utils/response.js';
import { idParam } from '../../shared/schemas/common.js';
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

// ── expenses: a registry resource (Phase I) — no toggle and no reorder, an expense has neither
mountResource(router, 'expenses', invoices.expenses, s.expenseSchema, {
  capability: 'expenses', query: s.expenseListQuery, toggle: false, reorder: false,
  extra: (r, { read, write }) => {
    r.get('/expenses/categories', read, asyncHandler(async (_req, res) => ok(res, await invoices.expenses.categories())));
    r.post('/expenses/bill', write, uploadLimiter, uploadImages.array('files', 1), asyncHandler(async (req, res) =>
      created(res, await invoices.expenses.uploadBill(req.files, { userId: req.user.id }))));
  },
});

// ── reports: JSON, or ?format=csv (routes/admin/reportRoute.js)
router.get('/reports/aging', ...reportRoute('aging', 'reports:finance', () => reports.agingReport()));
router.get('/reports/revenue', ...reportRoute('revenue', 'reports:finance', (q) => reports.revenueReport(q)));
router.get('/reports/collections', ...reportRoute('collections', 'reports:finance', (q) => reports.collectionsReport(q)));
router.get('/customers/:id/statement', ...reportRoute('statement', 'reports:finance', (q) => reports.customerStatement(q.customerId), {
  params: idParam, scope: (req) => ({ customerId: req.params.id }),
}));

export default router;
