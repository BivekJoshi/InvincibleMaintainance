import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam, listQuery, toPartial } from '../../shared/schemas/common.js';
import * as leads from '../../services/lead.service.js';
import * as customers from '../../services/customer.service.js';
import * as quotations from '../../services/quotation.service.js';
import { convertLead } from '../../services/convert.service.js';
import { makeCrud } from '../../services/crud.service.js';
import { recordAudit } from '../../services/audit.service.js';
import * as s from '../../shared/schemas/crm.js';

const router = Router();
const readLeads = requires('leads:read');
const writeLeads = requires('leads:write');

// ── leads
router.get('/leads', readLeads, validate({ query: s.leadListQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await leads.listLeads(req.validatedQuery);
  ok(res, items, meta);
}));

router.get('/leads/sla-board', readLeads, asyncHandler(async (_req, res) => ok(res, await leads.slaBoard())));

router.get('/leads/export.csv', readLeads, validate({ query: s.leadListQuery }), asyncHandler(async (req, res) => {
  const csv = await leads.exportLeadsCsv(req.validatedQuery);
  await recordAudit({ actorId: req.user.id, action: 'export', model: 'Lead', ip: req.ip, changes: req.validatedQuery });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${csv}`); // BOM so Excel renders Devanagari correctly
}));

router.post('/leads', writeLeads, validate({ body: s.adminLeadCreateSchema }),
  asyncHandler(async (req, res) => created(res, await leads.createLead(req.body, req.user.id))));

router.post('/leads/merge', writeLeads, validate({ body: s.leadMergeSchema }),
  asyncHandler(async (req, res) => ok(res, await leads.mergeLeads(req.body, req.user.id))));

router.get('/leads/:id', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await leads.getLead(req.params.id))));

router.get('/leads/:id/duplicates', readLeads, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await leads.findDuplicates(req.params.id))));

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

router.get('/customers', readCust, validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { items, meta } = await customers.listCustomers(req.validatedQuery);
  ok(res, items, meta);
}));
router.post('/customers', writeCust, validate({ body: s.customerSchema }),
  asyncHandler(async (req, res) => created(res, await customers.createCustomer(req.body))));
router.get('/customers/:id', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.getCustomer(req.params.id))));
router.get('/customers/:id/timeline', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.customerTimeline(req.params.id))));
router.put('/customers/:id', writeCust, validate({ params: idParam, body: toPartial(s.customerSchema) }),
  asyncHandler(async (req, res) => ok(res, await customers.updateCustomer(req.params.id, req.body))));
router.delete('/customers/:id', writeCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await customers.deleteCustomer(req.params.id); noContent(res); }));

router.get('/customers/:id/sites', readCust, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await customers.listSites(req.params.id))));
router.post('/customers/:id/sites', writeCust, validate({ params: idParam, body: s.customerSiteSchema }),
  asyncHandler(async (req, res) => created(res, await customers.createSite(req.params.id, req.body))));
router.put('/customers/:id/sites/:siteId', writeCust, validate({ body: toPartial(s.customerSiteSchema) }),
  asyncHandler(async (req, res) => ok(res, await customers.updateSite(req.params.id, req.params.siteId, req.body))));
router.delete('/customers/:id/sites/:siteId', writeCust,
  asyncHandler(async (req, res) => { await customers.deleteSite(req.params.id, req.params.siteId); noContent(res); }));

// ── rate card
const rateCard = makeCrud({
  model: 'rateCardItem', label: 'Rate card item', searchFields: ['name', 'code', 'category'], moneyFields: ['rate'],
});
router.get('/rate-card', requires('quotations:read'), validate({ query: listQuery.passthrough() }),
  asyncHandler(async (req, res) => { const { items, meta } = await rateCard.list(req.query); ok(res, items, meta); }));
router.post('/rate-card', requires('quotations:write'), validate({ body: s.rateCardItemSchema }),
  asyncHandler(async (req, res) => created(res, await rateCard.create(req.body))));
router.put('/rate-card/:id', requires('quotations:write'), validate({ params: idParam, body: toPartial(s.rateCardItemSchema) }),
  asyncHandler(async (req, res) => ok(res, await rateCard.update(req.params.id, req.body))));
router.delete('/rate-card/:id', requires('quotations:write'), validate({ params: idParam }),
  asyncHandler(async (req, res) => { await rateCard.remove(req.params.id); noContent(res); }));

// ── quotations
const readQ = requires('quotations:read');
const writeQ = requires('quotations:write');

router.get('/quotations', readQ, validate({ query: listQuery.passthrough() }), asyncHandler(async (req, res) => {
  const { items, meta } = await quotations.listQuotations(req.query);
  ok(res, items, meta);
}));
router.post('/quotations', writeQ, validate({ body: s.quotationSchema }),
  asyncHandler(async (req, res) => created(res, await quotations.createQuotation(req.body, req.user.id))));
router.get('/quotations/:id', readQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await quotations.getQuotation(req.params.id))));
router.put('/quotations/:id', writeQ, validate({ params: idParam, body: s.quotationUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await quotations.updateQuotation(req.params.id, req.body))));
router.post('/quotations/:id/send', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await quotations.sendQuotation(req.params.id))));
router.post('/quotations/:id/revise', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => created(res, await quotations.reviseQuotation(req.params.id, req.user.id))));
router.delete('/quotations/:id', writeQ, validate({ params: idParam }),
  asyncHandler(async (req, res) => { await quotations.deleteQuotation(req.params.id); noContent(res); }));

export default router;
