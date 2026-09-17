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

  it('lets a sent quotation expire, and only a revision follows', () => {
    expect(canTransition(QUOTATION_TRANSITIONS, 'SENT', 'EXPIRED')).toBe(true);
    expect(canTransition(QUOTATION_TRANSITIONS, 'EXPIRED', 'APPROVED')).toBe(false);
    expect(canTransition(QUOTATION_TRANSITIONS, 'EXPIRED', 'SENT')).toBe(false);
    expect(canTransition(QUOTATION_TRANSITIONS, 'EXPIRED', 'SUPERSEDED')).toBe(true);
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

describe('quotation transitions (Phase F)', () => {
  const ALLOWED = [
    ['DRAFT', 'PENDING_APPROVAL'],
    ['PENDING_APPROVAL', 'OFFICE_APPROVED'],
    ['PENDING_APPROVAL', 'DRAFT'],
    ['OFFICE_APPROVED', 'SENT'],
    ['OFFICE_APPROVED', 'DRAFT'],
    ['SENT', 'APPROVED'],
    ['SENT', 'CHANGES_REQUESTED'],
    ['SENT', 'REJECTED'],
    ['SENT', 'EXPIRED'],
    ['SENT', 'SUPERSEDED'],
    ['CHANGES_REQUESTED', 'SUPERSEDED'],
    ['REJECTED', 'SUPERSEDED'],
    ['EXPIRED', 'SUPERSEDED'],
    ['APPROVED', 'CONVERTED'],
  ];

  it.each(ALLOWED)('allows %s → %s', (from, to) => {
    expect(canTransition(QUOTATION_TRANSITIONS, from, to)).toBe(true);
  });

  it('allows nothing else', () => {
    const allowed = new Set(ALLOWED.map(([a, b]) => `${a}>${b}`));
    const states = Object.keys(QUOTATION_TRANSITIONS);
    for (const from of states) {
      for (const to of states) {
        if (from === to) continue;
        expect(canTransition(QUOTATION_TRANSITIONS, from, to), `${from} → ${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it.each([
    ['DRAFT', 'SENT'], // no quotation reaches the customer without approval
    ['DRAFT', 'OFFICE_APPROVED'], // auto-approval still passes through PENDING_APPROVAL
    ['PENDING_APPROVAL', 'SENT'],
    ['CHANGES_REQUESTED', 'SENT'],
    ['CHANGES_REQUESTED', 'APPROVED'],
    ['REJECTED', 'SENT'],
    ['SUPERSEDED', 'SENT'],
    ['SUPERSEDED', 'APPROVED'],
    ['CONVERTED', 'SUPERSEDED'],
    ['APPROVED', 'SUPERSEDED'],
  ])('refuses %s → %s', (from, to) => {
    expect(() => assertTransition(QUOTATION_TRANSITIONS, from, to, 'quotation')).toThrow(/Cannot move quotation/);
  });

  it('closes superseded and converted quotations for good', () => {
    expect(QUOTATION_TRANSITIONS.SUPERSEDED).toEqual([]);
    expect(QUOTATION_TRANSITIONS.CONVERTED).toEqual([]);
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
