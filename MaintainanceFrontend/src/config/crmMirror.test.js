import { describe, it, expect } from 'vitest';
import {
  CONTACT_ACTIVITY_TYPES, CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  LEAD_TRANSITIONS, LOGGABLE_ACTIVITY_TYPES, PREFERRED_LOCALE_OPTIONS,
  QUOTATION_STAGE_TABS, QUOTATION_STATUSES, QUOTATION_STATUS_LABELS, QUOTATION_TRANSITIONS, ROLES,
} from '@/config/constants';
import { AUDIT_EVENT_LABELS } from '@/config/auditEvents';
import { PERMISSIONS } from '@/helpers/permissions';
// The API's own rules. Outside `src/`, so `@/` cannot reach them.
import {
  LEAD_TRANSITIONS as API_TRANSITIONS, QUOTATION_TRANSITIONS as API_QUOTATION_TRANSITIONS,
} from '../../../MaintainanceBackend/src/shared/stateMachines.js';
import * as API_ENUMS from '../../../MaintainanceBackend/src/shared/enums.js';
import { PERMISSIONS as API_PERMISSIONS } from '../../../MaintainanceBackend/src/shared/permissions.js';

describe('the CRM rules mirror the API', () => {
  it('lead transitions are the API’s state machine', () => {
    expect(LEAD_TRANSITIONS).toEqual(API_TRANSITIONS);
  });

  it('lead statuses, sources and activity types match', () => {
    expect(LEAD_STATUSES).toEqual(API_ENUMS.LEAD_STATUSES);
    expect(LEAD_SOURCES).toEqual(API_ENUMS.LEAD_SOURCES);
    expect(LOGGABLE_ACTIVITY_TYPES).toEqual(API_ENUMS.LOGGABLE_ACTIVITY_TYPES);
    expect(CONTACT_ACTIVITY_TYPES).toEqual(API_ENUMS.CONTACT_ACTIVITY_TYPES);
    expect(CUSTOMER_TYPES).toEqual(API_ENUMS.CUSTOMER_TYPES);
    expect(PREFERRED_LOCALE_OPTIONS.map((o) => o.value)).toEqual(API_ENUMS.LOCALES);
  });

  it('every status and source has words', () => {
    expect(Object.keys(LEAD_STATUS_LABELS)).toEqual(LEAD_STATUSES);
    expect(Object.keys(LEAD_SOURCE_LABELS).sort()).toEqual([...LEAD_SOURCES].sort());
  });

  it('every audit event the API can write has a label, and nothing else does', () => {
    expect(Object.keys(AUDIT_EVENT_LABELS).sort()).toEqual(Object.values(API_ENUMS.AUDIT_EVENTS).sort());
  });

  it('quotation statuses, transitions and stages are the API’s', () => {
    expect(QUOTATION_STATUSES).toEqual(API_ENUMS.QUOTATION_STATUSES);
    expect(QUOTATION_TRANSITIONS).toEqual(API_QUOTATION_TRANSITIONS);
    expect(Object.keys(QUOTATION_STATUS_LABELS)).toEqual(QUOTATION_STATUSES);
    const stages = Object.fromEntries(QUOTATION_STAGE_TABS.map((t) => [t.value, t.statuses]));
    expect(stages).toEqual(API_ENUMS.QUOTATION_STAGES);
  });

  it('roles are the API’s', () => {
    expect(ROLES).toEqual(API_ENUMS.ROLES);
  });

  it('the capability map is the API’s', () => {
    expect(PERMISSIONS).toEqual(API_PERMISSIONS);
  });
});
