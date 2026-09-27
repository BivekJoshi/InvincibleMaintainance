import { describe, it, expect } from 'vitest';
import {
  CONTACT_ACTIVITY_TYPES, CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  LEAD_TRANSITIONS, LOGGABLE_ACTIVITY_TYPES, PREFERRED_LOCALE_OPTIONS,
  MESSAGE_CHANNELS, MESSAGE_STATUSES, QUOTATION_STAGE_TABS, QUOTATION_STATUSES, QUOTATION_STATUS_LABELS,
  QUOTATION_TRANSITIONS, ROLE_DESCRIPTIONS, ROLES,
  JOB_PHOTO_KINDS, JOB_PHOTO_KIND_LABELS, JOB_STATUSES, JOB_STATUS_LABELS, JOB_TRANSITIONS, JOB_TYPES, JOB_TYPE_LABELS,
  MANUAL_STOCK_MOVEMENTS, PRIORITIES, STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES,
  LEAD_OUTCOMES, LEAD_OUTCOME_LABELS, REACHED_OUTCOMES, NEXT_ACTION_TYPES, NEXT_ACTION_LABELS,
  LOST_CATEGORIES, LOST_CATEGORY_LABELS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, BUDGET_BANDS, BUDGET_BAND_LABELS,
  DECISION_MAKERS, DECISION_MAKER_LABELS,
  UNITS, RATE_MODES, RATE_MODE_LABELS, RECIPE_COMPONENT_KINDS, RECIPE_COMPONENT_LABELS,
  CONTRACT_TYPES, CONTRACT_TYPE_LABELS, PAYMENT_TRIGGERS, PAYMENT_TRIGGER_LABELS, PAYMENT_SCHEDULE_PRESETS, DECLINE_CATEGORIES,
} from '@/config/constants';
import { AUDIT_EVENT_LABELS } from '@/config/auditEvents';
import { PERMISSIONS, can } from '@/helpers/permissions';
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

  it('the follow-up lists are the API’s, and every value has words (Phase L1)', () => {
    const lists = [
      [LEAD_OUTCOMES, API_ENUMS.LEAD_OUTCOMES, LEAD_OUTCOME_LABELS],
      [NEXT_ACTION_TYPES, API_ENUMS.NEXT_ACTION_TYPES, NEXT_ACTION_LABELS],
      [LOST_CATEGORIES, API_ENUMS.LOST_CATEGORIES, LOST_CATEGORY_LABELS],
      [PROPERTY_TYPES, API_ENUMS.PROPERTY_TYPES, PROPERTY_TYPE_LABELS],
      [BUDGET_BANDS, API_ENUMS.BUDGET_BANDS, BUDGET_BAND_LABELS],
      [DECISION_MAKERS, API_ENUMS.DECISION_MAKERS, DECISION_MAKER_LABELS],
    ];
    for (const [mine, theirs, labels] of lists) {
      expect(mine).toEqual(theirs);
      expect(Object.keys(labels)).toEqual(mine);
      expect(Object.values(labels).every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    }
    expect(REACHED_OUTCOMES).toEqual(API_ENUMS.REACHED_OUTCOMES);
    expect(REACHED_OUTCOMES.every((o) => LEAD_OUTCOMES.includes(o))).toBe(true);
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

  it('the money wall’s capabilities are held as the API holds them (Phase L2)', () => {
    const holders = (capability) => Object.keys(API_PERMISSIONS).filter((role) => can(role, capability)).sort();
    expect(holders('costs:read')).toEqual(['ADMIN', 'MANAGER']);
    expect(holders('rates:write')).toEqual(['ADMIN', 'MANAGER']);
    expect(holders('rates:read')).toEqual(['ACCOUNTANT', 'ADMIN', 'MANAGER', 'SALES']);
    expect(holders('jobs:advance-override')).toEqual(['ADMIN', 'MANAGER']);
    for (const role of ['SURVEYOR', 'TECHNICIAN']) {
      expect(['costs:read', 'rates:read', 'rates:write'].some((c) => can(role, c)), role).toBe(false);
    }
  });

  it('units, rate modes and recipe kinds are the API’s, and each has words (Phase L2)', () => {
    expect(UNITS).toEqual(API_ENUMS.UNITS);
    expect(RATE_MODES).toEqual(API_ENUMS.RATE_MODES);
    expect(Object.keys(RATE_MODE_LABELS)).toEqual(RATE_MODES);
    expect(RECIPE_COMPONENT_KINDS).toEqual(API_ENUMS.RECIPE_COMPONENT_KINDS);
    expect(Object.keys(RECIPE_COMPONENT_LABELS)).toEqual(RECIPE_COMPONENT_KINDS);
  });

  it('contract types, payment triggers and the decline reasons are the API’s, and each has words (Phase L4)', () => {
    expect(CONTRACT_TYPES).toEqual(API_ENUMS.CONTRACT_TYPES);
    expect(Object.keys(CONTRACT_TYPE_LABELS)).toEqual(CONTRACT_TYPES);
    expect(PAYMENT_TRIGGERS).toEqual(API_ENUMS.PAYMENT_TRIGGERS);
    expect(Object.keys(PAYMENT_TRIGGER_LABELS)).toEqual(PAYMENT_TRIGGERS);
    // The customer's decline reasons are lost categories, so the "Mark lost?" prompt can start from one.
    expect(DECLINE_CATEGORIES.every((c) => API_ENUMS.LOST_CATEGORIES.includes(c))).toBe(true);
    expect(DECLINE_CATEGORIES).toContain('OTHER');
    // Every preset is a schedule the API accepts: 100 %, at most one advance, known triggers.
    for (const preset of PAYMENT_SCHEDULE_PRESETS) {
      expect(preset.stages.reduce((sum, st) => sum + st.pct * 100, 0), preset.key).toBe(10000);
      expect(preset.stages.filter((st) => st.trigger === 'ON_ACCEPT').length).toBeLessThanOrEqual(1);
      expect(preset.stages.every((st) => PAYMENT_TRIGGERS.includes(st.trigger))).toBe(true);
    }
  });

  it('the Excel export is audited in words (Phase L4)', () => {
    expect(API_ENUMS.AUDIT_EVENTS.EXPORT_XLSX).toBe('export.xlsx');
    expect(AUDIT_EVENT_LABELS['export.xlsx']).toBe('Quotation exported to Excel');
  });
});
