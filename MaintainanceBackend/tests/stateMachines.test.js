import { describe, it, expect } from 'vitest';
import {
  JOB_TRANSITIONS, LEAD_TRANSITIONS, INVOICE_TRANSITIONS, QUOTATION_TRANSITIONS,
  canTransition, assertTransition,
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
