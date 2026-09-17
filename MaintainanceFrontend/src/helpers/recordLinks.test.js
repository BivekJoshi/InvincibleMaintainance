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

  it('has no link for records without a screen yet', () => {
    expect(recordHref({ model: 'Job', recordId: 'j1' })).toBeNull();
    expect(recordHref({ model: 'Invoice', recordId: 'i1' })).toBeNull();
    expect(recordHref({ model: 'Lead', recordId: null })).toBeNull();
  });
});
