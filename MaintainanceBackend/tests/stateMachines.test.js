import { describe, it, expect } from 'vitest';
import {
  JOB_TRANSITIONS, LEAD_TRANSITIONS, INVOICE_TRANSITIONS, QUOTATION_TRANSITIONS,
  SURVEY_TRANSITIONS, canTransition, assertTransition,
} from '../src/shared/stateMachines.js';

describe('state machines', () => {
  it('allows the normal job lifecycle', () => {
    const path = ['DRAFT', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(JOB_TRANSITIONS, path[i], path[i + 1])).toBe(true);
    }
  });

  it('refuses to reopen a closed job', () => {
    expect(canTransition(JOB_TRANSITIONS, 'COMPLETED', 'SCHEDULED')).toBe(false);
    expect(canTransition(JOB_TRANSITIONS, 'VERIFIED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition(JOB_TRANSITIONS, 'CANCELLED', 'SCHEDULED')).toBe(false);
  });

  it('refuses to skip the middle of the lead funnel backwards', () => {
    expect(canTransition(LEAD_TRANSITIONS, 'WON', 'NEW')).toBe(false);
    expect(canTransition(LEAD_TRANSITIONS, 'NEW', 'CONTACTED')).toBe(true);
  });

  it('locks a converted quotation', () => {
    expect(canTransition(QUOTATION_TRANSITIONS, 'CONVERTED', 'SENT')).toBe(false);
    expect(canTransition(QUOTATION_TRANSITIONS, 'APPROVED', 'CONVERTED')).toBe(true);
  });

  it('locks a void invoice', () => {
    expect(canTransition(INVOICE_TRANSITIONS, 'VOID', 'SENT')).toBe(false);
  });

  it('lets a voided payment walk an invoice back down', () => {
    // A bounced cheque on a settled invoice: PAID → PARTIAL, or all the way back
    // to SENT / OVERDUE when it was the only payment.
    expect(canTransition(INVOICE_TRANSITIONS, 'PAID', 'PARTIAL')).toBe(true);
    expect(canTransition(INVOICE_TRANSITIONS, 'PAID', 'SENT')).toBe(true);
    expect(canTransition(INVOICE_TRANSITIONS, 'PAID', 'OVERDUE')).toBe(true);
    expect(canTransition(INVOICE_TRANSITIONS, 'PARTIAL', 'SENT')).toBe(true);
    expect(canTransition(INVOICE_TRANSITIONS, 'PAID', 'DRAFT')).toBe(false);
    expect(canTransition(INVOICE_TRANSITIONS, 'VOID', 'PAID')).toBe(false);
  });

  it('lets a sent quotation expire, and nothing but a resend follows', () => {
    expect(canTransition(QUOTATION_TRANSITIONS, 'SENT', 'EXPIRED')).toBe(true);
    expect(canTransition(QUOTATION_TRANSITIONS, 'EXPIRED', 'APPROVED')).toBe(false);
  });

  it('throws a 422 with the allowed set listed', () => {
    try {
      assertTransition(JOB_TRANSITIONS, 'COMPLETED', 'DRAFT', 'job');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.status).toBe(422);
      expect(err.code).toBe('INVALID_TRANSITION');
      expect(err.message).toContain('VERIFIED');
    }
  });
});

describe('survey transitions', () => {
  it('lets a reviewer send a survey back to the field and take it forward again', () => {
    expect(canTransition(SURVEY_TRANSITIONS, 'SUBMITTED', 'RETURNED')).toBe(true);
    expect(canTransition(SURVEY_TRANSITIONS, 'RETURNED', 'DRAFT')).toBe(true);
    expect(canTransition(SURVEY_TRANSITIONS, 'RETURNED', 'SUBMITTED')).toBe(true);
  });

  it('only quotes a survey that has actually been submitted', () => {
    expect(canTransition(SURVEY_TRANSITIONS, 'SUBMITTED', 'QUOTED')).toBe(true);
    expect(canTransition(SURVEY_TRANSITIONS, 'IN_REVIEW', 'QUOTED')).toBe(true);
    expect(canTransition(SURVEY_TRANSITIONS, 'DRAFT', 'QUOTED')).toBe(false);
  });

  it('closes a quoted survey for good', () => {
    expect(canTransition(SURVEY_TRANSITIONS, 'QUOTED', 'DRAFT')).toBe(false);
    expect(canTransition(SURVEY_TRANSITIONS, 'QUOTED', 'RETURNED')).toBe(false);
    // A replayed offline submit lands here — the client must treat it as terminal.
    expect(() => assertTransition(SURVEY_TRANSITIONS, 'SUBMITTED', 'SUBMITTED')).not.toThrow();
    expect(() => assertTransition(SURVEY_TRANSITIONS, 'QUOTED', 'SUBMITTED', 'survey')).toThrow(/Cannot move survey/);
  });
});
