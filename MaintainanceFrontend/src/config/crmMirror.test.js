import { describe, it, expect } from 'vitest';
import {
  CONTACT_ACTIVITY_TYPES, CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  LEAD_TRANSITIONS, LOGGABLE_ACTIVITY_TYPES, PREFERRED_LOCALE_OPTIONS,
  MESSAGE_CHANNELS, MESSAGE_STATUSES, QUOTATION_STAGE_TABS, QUOTATION_STATUSES, QUOTATION_STATUS_LABELS,
  QUOTATION_TRANSITIONS, ROLE_DESCRIPTIONS, ROLES,
  JOB_PHOTO_KINDS, JOB_PHOTO_KIND_LABELS, JOB_STATUSES, JOB_STATUS_LABELS, JOB_TRANSITIONS, JOB_TYPES, JOB_TYPE_LABELS,
  MANUAL_STOCK_MOVEMENTS, PRIORITIES, STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES,
} from '@/config/constants';
import { AUDIT_EVENT_LABELS } from '@/config/auditEvents';
import { PERMISSIONS } from '@/helpers/permissions';
// The API's own rules. Outside `src/`, so `@/` cannot reach them.
import {
  JOB_TRANSITIONS as API_JOB_TRANSITIONS,
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

  it('job statuses, types, transitions, photo kinds and stock movements are the API’s', () => {
    expect(JOB_STATUSES).toEqual(API_ENUMS.JOB_STATUSES);
    expect(JOB_TYPES).toEqual(API_ENUMS.JOB_TYPES);
    expect(PRIORITIES).toEqual(API_ENUMS.PRIORITIES);
    expect(JOB_TRANSITIONS).toEqual(API_JOB_TRANSITIONS);
    expect(Object.keys(JOB_STATUS_LABELS)).toEqual(JOB_STATUSES);
    expect(Object.keys(JOB_TYPE_LABELS)).toEqual(JOB_TYPES);
    expect(JOB_PHOTO_KINDS).toEqual(API_ENUMS.JOB_PHOTO_KINDS);
    expect(Object.keys(JOB_PHOTO_KIND_LABELS)).toEqual(JOB_PHOTO_KINDS);
    expect(STOCK_MOVEMENT_TYPES).toEqual(API_ENUMS.STOCK_MOVEMENT_TYPES);
    expect(Object.keys(STOCK_MOVEMENT_LABELS)).toEqual(STOCK_MOVEMENT_TYPES);
    expect(MANUAL_STOCK_MOVEMENTS).toEqual(STOCK_MOVEMENT_TYPES.filter((t) => t !== 'ISSUE_TO_JOB'));
  });

  it('roles are the API’s', () => {
    expect(ROLES).toEqual(API_ENUMS.ROLES);
    expect(Object.keys(ROLE_DESCRIPTIONS).sort()).toEqual([...ROLES].sort());
  });

  it('message channels and delivery states are the API’s', () => {
    expect(MESSAGE_CHANNELS).toEqual(API_ENUMS.MESSAGE_CHANNELS);
    expect(MESSAGE_STATUSES).toEqual(API_ENUMS.MESSAGE_STATUSES);
  });

  it('the capability map is the API’s', () => {
    expect(PERMISSIONS).toEqual(API_PERMISSIONS);
  });
});
