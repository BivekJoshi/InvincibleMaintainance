import { describe, it, expect } from 'vitest';
import {
  AMC_BILLING_CYCLES, AMC_BILLING_CYCLE_LABELS, AMC_STATUSES, AMC_STATUS_LABELS, AMC_VISIT_STATUSES,
  AMC_VISIT_STATUS_LABELS, CLAIM_STATUSES, CLAIM_STATUS_LABELS, REMINDER_STATUSES, REMINDER_STATUS_LABELS,
  WARRANTY_STATUSES, WARRANTY_STATUS_LABELS, MESSAGE_CHANNELS, REMINDER_CHANNEL_LABELS,
} from '@/config/constants';
import {
  AMC_TONE, AMC_VISIT_TONE, CLAIM_TONE, REMINDER_TONE, WARRANTY_TONE,
} from '@/config/admin/aftercareViews';
import { PERMISSIONS, can } from '@/helpers/permissions';
// The API's own lists. Outside `src/`, so `@/` cannot reach them.
import * as API_ENUMS from '../../../MaintainanceBackend/src/shared/enums.js';
import { PERMISSIONS as API_PERMISSIONS } from '../../../MaintainanceBackend/src/shared/permissions.js';

const AFTERCARE = ['warranties', 'amc', 'reminders'];
const holders = (capability) => Object.keys(API_PERMISSIONS).filter((role) => can(role, capability)).sort();

describe('aftercare mirrors the API (Phase I)', () => {
  it('the capability map is the API’s', () => {
    expect(PERMISSIONS).toEqual(API_PERMISSIONS);
  });

  it('keeps today’s access: SALES, MANAGER and DISPATCHER read; DISPATCHER writes; ACCOUNTANT holds none', () => {
    for (const domain of AFTERCARE) {
      expect(holders(`${domain}:read`), `${domain}:read`).toEqual(['ADMIN', 'DISPATCHER', 'MANAGER', 'SALES']);
      expect(holders(`${domain}:write`), `${domain}:write`).toEqual(['ADMIN', 'DISPATCHER']);
    }
    for (const role of ['ACCOUNTANT', 'EDITOR', 'TECHNICIAN', 'SURVEYOR']) {
      expect(AFTERCARE.flatMap((d) => [`${d}:read`, `${d}:write`]).some((c) => can(role, c)), role).toBe(false);
    }
  });

  it('every status list is the API’s, and each value has words and a tone', () => {
    const lists = [
      [WARRANTY_STATUSES, API_ENUMS.WARRANTY_STATUSES, WARRANTY_STATUS_LABELS, WARRANTY_TONE],
      [CLAIM_STATUSES, API_ENUMS.CLAIM_STATUSES, CLAIM_STATUS_LABELS, CLAIM_TONE],
      [AMC_STATUSES, API_ENUMS.AMC_STATUSES, AMC_STATUS_LABELS, AMC_TONE],
      [AMC_VISIT_STATUSES, API_ENUMS.AMC_VISIT_STATUSES, AMC_VISIT_STATUS_LABELS, AMC_VISIT_TONE],
      [REMINDER_STATUSES, API_ENUMS.REMINDER_STATUSES, REMINDER_STATUS_LABELS, REMINDER_TONE],
    ];
    for (const [ours, theirs, labels, tones] of lists) {
      expect(ours).toEqual(theirs);
      expect(Object.keys(labels).sort()).toEqual([...ours].sort());
      expect(Object.keys(tones).sort()).toEqual([...ours].sort());
    }
    expect(AMC_BILLING_CYCLES).toEqual(API_ENUMS.AMC_BILLING_CYCLES);
    expect(Object.keys(AMC_BILLING_CYCLE_LABELS)).toEqual(AMC_BILLING_CYCLES);
    // A reminder goes out on a message channel.
    expect(Object.keys(REMINDER_CHANNEL_LABELS)).toEqual(MESSAGE_CHANNELS);
  });
});
