import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, reorderBody, toPartial } from '../../shared/schemas/common.js';
import * as leads from '../../services/lead.service.js';
import * as customers from '../../services/customer.service.js';
import * as quotations from '../../services/quotation.service.js';
import { convertLead, customerMatches } from '../../services/convert.service.js';
import { historyRoute } from './historyRoute.js';
import { can } from '../../shared/permissions.js';
import { makeCrud } from '../../services/crud.service.js';
import { recordEvent } from '../../services/audit.service.js';
import * as s from '../../shared/schemas/crm.js';
import * as jobs from '../../services/job.service.js';
import { quotationToJobSchema } from '../../shared/schemas/ops.js';

const router = Router();
const readLeads = requires('leads:read');
const writeLeads = requires('leads:write');

/** `assignedToId=me` is the caller — the "My leads" view every salesperson opens on. */
const leadQuery = (req) => ({
  ...req.validatedQuery,
  ...(req.validatedQuery.assignedToId === 'me' ? { assignedToId: req.user.id } : {}),
});

// ── leads
router.get('/leads', readLeads, validate({ query: s.leadListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await leads.listLeads(leadQuery(req));
  ok(res, items, meta);
}));

router.get('/leads/sla-board', readLeads, asyncHandler(async (_req, res) => ok(res, await leads.slaBoard())));

router.get('/leads/export.csv', readLeads, validate({ query: s.leadListQuery }), asyncHandler(async (req, res) => {
  const query = leadQuery(req);
  const csv = await leads.exportLeadsCsv(query);
  await recordEvent('export.csv', { model: 'Lead', meta: query });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${csv}`); // BOM so Excel renders Devanagari correctly
}));

router.post('/leads', writeLeads, validate({ body: s.adminLeadCreateSchema }),
  asyncHandler(async (req, res) => created(res, await leads.createLead(req.body, req.user.id))));

router.post('/leads/merge', writeLeads, validate({ body: s.leadMergeSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.mergeLeads(req.body, req.user.id))));

router.post('/leads/bulk-assign', writeLeads, validate({ body: s.leadBulkAssignSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.bulkAssign(req.body, req.user.id))));

// The people a lead can be given to. /admin/users is ADMIN's; sales needs this list to assign.
router.get('/leads/assignees', readLeads, validate({ query: s.assigneeQuery }),
  asyncHandler(async (req, res) => ok(res, await leads.listAssignees(req.validatedQuery))));
router.get('/leads/assignees/:id', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await leads.getAssignee(req.params.id))));

router.get('/leads/:id', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await leads.getLead(req.params.id))));

router.get('/leads/:id/duplicates', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await leads.findDuplicates(req.params.id))));

router.get('/leads/:id/customer-matches', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customerMatches(req.params.id))));

router.get('/leads/:id/history', ...historyRoute('Lead', 'leads:history'));

router.put('/leads/:id', writeLeads, validate({ params: idParam, body: s.leadUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.updateLead(req.params.id, req.body))));

router.patch('/leads/:id/status', writeLeads, validate({ params: idParam, body: s.leadStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.changeStatus(req.params.id, req.body, req.user.id))));

router.patch('/leads/:id/assign', writeLeads, validate({ params: idParam, body: s.leadAssignSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.assignLead(req.params.id, req.body, req.user.id))));

router.post('/leads/:id/notes', writeLeads, validate({ params: idParam, body: s.leadNoteSchema }),
  asyncHandler(async (req, res) => created(res, await leads.addNote(req.params.id, req.body.note, req.user.id))));

router.post('/leads/:id/activities', writeLeads, validate({ params: idParam, body: s.leadActivitySchema }),
  asyncHandler(async (req, res) => created(res, await leads.addActivity(req.params.id, req.body, req.user.id))));

router.post('/leads/:id/convert', writeLeads, validate({ params: idParam, body: s.leadConvertSchema }),
  asyncHandler(async (req, res) => created(res, await convertLead(req.params.id, req.body, req.user.id))));

router.delete('/leads/:id', writeLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await leads.deleteLead(req.params.id); noContent(res); }));

// ── customers
const readCust = requires('customers:read');
const writeCust = requires('customers:write');

// A balance is money: only a caller who may read invoices gets it.
router.get('/customers', readCust, validate({ query: s.customerListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await customers.listCustomers(req.validatedQuery, { withBalance: can(req.user.role, 'invoices:read') });
  ok(res, items, meta);
}));
router.get('/customers/summary', readCust, asyncHandler(async (req, res) =>
  ok(res, await customers.customerSummary({ withBalance: can(req.user.role, 'invoices:read') }))));
router.post('/customers', writeCust, validate({ body: s.customerSchema }),
  asyncHandler(async (req, res) => created(res, await customers.createCustomer(req.body))));
router.get('/customers/:id', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.getCustomer(req.params.id))));
router.get('/customers/:id/timeline', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.customerTimeline(req.params.id))));
router.get('/customers/:id/history', ...historyRoute('Customer', 'customers:history'));
router.put('/customers/:id', writeCust, validate({ params: idParam, body: s.customerUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await customers.updateCustomer(req.params.id, req.body))));
router.delete('/customers/:id', writeCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await customers.deleteCustomer(req.params.id); noContent(res); }));

router.get('/customers/:id/sites', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.listSites(req.params.id))));
router.post('/customers/:id/sites', writeCust, validate({ params: idParam, body: s.customerSiteSchema }),
  asyncHandler(async (req, res) => created(res, await customers.createSite(req.params.id, req.body))));
router.put('/customers/:id/sites/:siteId', writeCust, validate({ params: s.siteParams, body: s.customerSiteUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await customers.updateSite(req.params.id, req.params.siteId, req.body))));
router.delete('/customers/:id/sites/:siteId', writeCust, validate({ params: s.siteParams }),
  asyncHandler(async (req, res) => { await customers.deleteSite(req.params.id, req.params.siteId); noContent(res); }));

// ── rate card
const rateCard = makeCrud({
  model: 'rateCardItem', label: 'Rate card item', searchFields: ['name', 'code', 'category'], moneyFields: ['rate'],
});
// The same surface as a CMS resource (list, get, create, update, toggle, reorder, delete, restore), so the
// back office manages it through the generic resource screens; the capabilities are the quotation ones.
const readRate = requires('quotations:read');
const writeRate = requires('quotations:write');
router.get('/rate-card', readRate, validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await rateCard.list(req.query); ok(res, items, meta); }));
router.post('/rate-card', writeRate, validate({ body: s.rateCardItemSchema }),
  asyncHandler(async (req, res) => created(res, await rateCard.create(req.body))));
router.patch('/rate-card/reorder', writeRate, validate({ body: reorderBody }),
  asyncHandler(async (req, res) => { await rateCard.reorder(req.body.items); noContent(res); }));
router.get('/rate-card/:id', readRate, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await rateCard.get(req.params.id))));
router.put('/rate-card/:id', writeRate, validate({ params: idParam, body: toPartial(s.rateCardItemSchema) }),
  asyncHandler(async (req, res) => ok(res, await rateCard.update(req.params.id, req.body))));
router.get('/rate-card/:id/history', ...historyRoute('RateCardItem', 'quotations:history'));
router.patch('/rate-card/:id/toggle', writeRate, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await rateCard.toggle(req.params.id))));
router.patch('/rate-card/:id/restore', writeRate, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await rateCard.restore(req.params.id))));
// Soft delete: quotation and survey lines keep pointing at the item. `?hard=true` needs cms:purge (ADMIN).
router.delete('/rate-card/:id', writeRate, validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await rateCard.remove(req.params.id, { hard: req.query.hard === 'true', role: req.user.role });
    noContent(res);
  }));

// ── quotations
const readQ = requires('quotations:read');
const writeQ = requires('quotations:write');

const approveQ = requires('quotations:approve');

router.get('/quotations', readQ, validate({ query: s.quotationListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await quotations.listQuotations(req.validatedQuery);
  ok(res, items, meta);
}));
router.post('/quotations', writeQ, validate({ body: s.quotationSchema }),
  asyncHandler(async (req, res) => created(res, await quotations.createQuotation(req.body, req.user.id))));
router.get('/quotations/:id', readQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await quotations.getQuotation(req.params.id))));
router.get('/quotations/:id/history', ...historyRoute('Quotation', 'quotations:history'));
router.put('/quotations/:id', writeQ, validate({ params: idParam, body: s.quotationUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await quotations.updateQuotation(req.params.id, req.body))));
// Internal approval: no quotation is sent until a MANAGER/ADMIN (or the auto-approval limit) approves it.
router.post('/quotations/:id/submit', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await quotations.submitQuotation(req.params.id, req.user.id))));
router.post('/quotations/:id/approve', approveQ, validate({ params: idParam, body: s.quotationApproveSchema }),
  asyncHandler(async (req, res) => ok(res, await quotations.approveQuotation(req.params.id, req.body, req.user.id))));
router.post('/quotations/:id/send-back', approveQ, validate({ params: idParam, body: s.quotationReturnSchema }),
  asyncHandler(async (req, res) => ok(res, await quotations.sendBackQuotation(req.params.id, req.body, req.user.id))));
router.post('/quotations/:id/pull-back', writeQ, validate({ params: idParam, body: s.quotationReturnSchema }),
  asyncHandler(async (req, res) => ok(res, await quotations.pullBackQuotation(req.params.id, req.body))));
router.post('/quotations/:id/send', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await quotations.sendQuotation(req.params.id))));
router.post('/quotations/:id/revise', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => created(res, await quotations.reviseQuotation(req.params.id, req.user.id))));
// Scheduling the crew is dispatch's call, so this takes jobs:write rather than
// quotations:write — SALES can win the work but not put people on it. Since Phase F a
// customer's acceptance creates the job itself; this stays for quotations APPROVED before
// that, and refuses one that already has its job.
router.post('/quotations/:id/convert-to-job', requires('jobs:write'),
  validate({ params: idParam, body: quotationToJobSchema }),
  asyncHandler(async (req, res) => created(res, await jobs.createJobFromQuotation(req.params.id, req.body, req.user.id))));
router.delete('/quotations/:id', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await quotations.deleteQuotation(req.params.id); noContent(res); }));

export default router;
