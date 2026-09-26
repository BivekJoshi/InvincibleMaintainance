import { describe, it, expect } from 'vitest';
import { notificationHref } from './notificationLinks';

describe('notificationHref', () => {
  it('prefixes the admin paths the API writes without /admin', () => {
    expect(notificationHref('/leads/cl1')).toBe('/admin/leads/cl1');
    expect(notificationHref('/quotations/cl2')).toBe('/admin/quotations/cl2');
    expect(notificationHref('/invoices?overdueOnly=true')).toBe('/admin/invoices?overdueOnly=true');
  });

  it('keeps paths that are already in-app', () => {
    expect(notificationHref('/admin/surveys/cl3')).toBe('/admin/surveys/cl3');
    expect(notificationHref('/tech/jobs/cl4')).toBe('/tech/jobs/cl4');
    expect(notificationHref('/quotation/tok_abc')).toBe('/quotation/tok_abc');
  });

  it('turns an absolute app URL into an in-app path', () => {
    expect(notificationHref('https://gharjatan.com.np/leads/cl5')).toBe('/admin/leads/cl5');
    expect(notificationHref('http://localhost:5400/admin/leads/cl6#notes')).toBe('/admin/leads/cl6#notes');
  });

  it('opens the Phase L1 reminders where they point, query and all', () => {
    // lead_followup_due, the pipeline_* reminders — the lead's page
    expect(notificationHref('/admin/leads/cl8')).toBe('/admin/leads/cl8');
    // lead_mark_lost — the lead with the Mark lost dialog open
    expect(notificationHref('/admin/leads/cl8?markLost=1')).toBe('/admin/leads/cl8?markLost=1');
    expect(notificationHref('https://gharjatan.com.np/admin/leads/cl8?markLost=1')).toBe('/admin/leads/cl8?markLost=1');
    // lead_followup_digest — the "Due today" view
    expect(notificationHref('/admin/leads?nextAction=due_today')).toBe('/admin/leads?nextAction=due_today');
    expect(notificationHref('/leads?nextAction=due_today')).toBe('/admin/leads?nextAction=due_today');
  });

  it('has nowhere to go without a usable link', () => {
    expect(notificationHref(null)).toBeNull();
    expect(notificationHref('')).toBeNull();
    expect(notificationHref('leads/cl7')).toBeNull();
    expect(notificationHref('//evil.example.com/x')).toBeNull();
    expect(notificationHref('javascript:alert(1)')).toBeNull();
  });
});
