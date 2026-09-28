import { describe, it, expect } from 'vitest';
import { recordHref } from '@/helpers/recordLinks';

describe('recordHref', () => {
  it('links the records that have a page', () => {
    expect(recordHref({ model: 'Lead', recordId: 'l1' })).toBe('/admin/leads/l1');
    expect(recordHref({ model: 'Quotation', recordId: 'q1' })).toBe('/admin/quotations/q1');
    expect(recordHref({ model: 'Faq', recordId: 'f1' })).toBe('/admin/content/faqs/f1');
    expect(recordHref({ model: 'RateCardItem', recordId: 'r1' })).toBe('/admin/rate-card/r1');
    expect(recordHref({ model: 'Setting', recordId: 'branding.tagline' })).toBe('/admin/platform/settings');
    expect(recordHref({ model: 'User', recordId: 'u1' })).toBe('/admin/platform/users?open=u1');
  });

  it('links a child row to its parent', () => {
    expect(recordHref({ model: 'LeadNote', recordId: 'n1', after: { leadId: 'l9' } })).toBe('/admin/leads/l9');
    expect(recordHref({ model: 'CustomerSite', recordId: 's1', before: { customerId: 'c9' } })).toBe('/admin/customers/c9');
    expect(recordHref({ model: 'ProjectImage', recordId: 'p1', after: { projectId: 'p9' } })).toBe('/admin/content/projects/p9');
    expect(recordHref({ model: 'Translation', recordId: 't1', after: { model: 'service', recordId: 's9' } })).toBe('/admin/content/services/s9');
    expect(recordHref({ model: 'LeadNote', recordId: 'n1', after: { body: 'x' } })).toBeNull();
  });

  it('links a job, and its parts to the job (Phase H1)', () => {
    expect(recordHref({ model: 'Job', recordId: 'j1' })).toBe('/admin/jobs/j1');
    expect(recordHref({ model: 'JobTask', recordId: 't1', after: { jobId: 'j9' } })).toBe('/admin/jobs/j9');
    expect(recordHref({ model: 'TimeLog', recordId: 'l1', before: { jobId: 'j8' } })).toBe('/admin/jobs/j8');
    expect(recordHref({ model: 'Technician', recordId: 'x1' })).toBe('/admin/technicians/x1');
    expect(recordHref({ model: 'Material', recordId: 'm1' })).toBe('/admin/materials/m1');
  });

  it('links a trade, and a recipe line to its rate (Phase L2)', () => {
    expect(recordHref({ model: 'Trade', recordId: 'tr1' })).toBe('/admin/trades/tr1');
    expect(recordHref({ model: 'RateCardComponent', recordId: 'c1', after: { rateCardItemId: 'r9' } })).toBe('/admin/rate-card/r9');
  });

  it('has no link for records without a screen', () => {
    expect(recordHref({ model: 'Report', recordId: null })).toBeNull();
    expect(recordHref({ model: 'Lead', recordId: null })).toBeNull();
  });

  it('links an invoice, its payments and lines, and an expense (Phase I)', () => {
    expect(recordHref({ model: 'Invoice', recordId: 'i1' })).toBe('/admin/invoices/i1');
    expect(recordHref({ model: 'Payment', recordId: 'p1', after: { invoiceId: 'i1', amount: 100000 } })).toBe('/admin/invoices/i1');
    expect(recordHref({ model: 'InvoiceItem', recordId: 'it1', before: { invoiceId: 'i2' } })).toBe('/admin/invoices/i2');
    expect(recordHref({ model: 'Expense', recordId: 'ex1' })).toBe('/admin/expenses/ex1');
  });

  it('links a purchase list and its items, and a site diary day to its job’s diary (Phase L7)', () => {
    expect(recordHref({ model: 'PurchaseList', recordId: 'pl1' })).toBe('/admin/purchase-lists/pl1');
    expect(recordHref({ model: 'PurchaseListItem', recordId: 'it1', after: { listId: 'pl1' } })).toBe('/admin/purchase-lists/pl1');
    expect(recordHref({ model: 'SiteDiary', recordId: 'd1', meta: { jobId: 'j9', day: '2026-09-28' } })).toBe('/admin/jobs/j9?tab=diary');
    expect(recordHref({ model: 'SiteDiary', recordId: 'd1', after: { jobId: 'j9' } })).toBe('/admin/jobs/j9?tab=diary');
    expect(recordHref({ model: 'SiteDiary', recordId: 'd1' })).toBeNull();
  });
});
