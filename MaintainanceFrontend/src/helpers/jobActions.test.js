import { describe, expect, it } from 'vitest';
import { jobActions, jobWaitingFor, openTasks, siteMapHref } from '@/helpers/jobActions';
import { JOB_STATUSES, JOB_TRANSITIONS } from '@/config/constants';
import { can as roleCan } from '@/helpers/permissions';

const ctx = (role) => ({ can: (c) => roleCan(role, c) });
const job = (status, extra = {}) => ({
  id: 'j1', status, assignments: [{ technicianId: 't1', isLead: true }], tasks: [], scheduledStart: null, ...extra,
});
const keys = (actions) => actions.map((a) => (a.to ? `${a.key}:${a.to}` : a.key));

describe('jobActions', () => {
  it('only ever offers moves the state machine allows', () => {
    for (const status of JOB_STATUSES) {
      for (const action of jobActions(job(status), ctx('ADMIN'))) {
        if (action.key === 'status') expect(JOB_TRANSITIONS[status], `${status} → ${action.to}`).toContain(action.to);
        if (action.key === 'complete') expect(JOB_TRANSITIONS[status]).toContain('COMPLETED');
        if (action.key === 'verify') expect(JOB_TRANSITIONS[status]).toContain('VERIFIED');
      }
    }
  });

  it('offers a dispatcher scheduling and assignment on a new job', () => {
    const actions = jobActions(job('DRAFT', { assignments: [] }), ctx('DISPATCHER'));
    expect(keys(actions)).toEqual(['schedule', 'assign', 'status:CANCELLED', 'delete']);
    expect(actions[0]).toMatchObject({ label: 'Schedule', primary: true });
    expect(actions[1].label).toBe('Assign technicians');
  });

  it('says Reschedule once a job has a window, and never reschedules work under way', () => {
    expect(jobActions(job('ASSIGNED', { scheduledStart: '2026-09-18T04:15:00Z' }), ctx('DISPATCHER'))[0].label).toBe('Reschedule');
    expect(keys(jobActions(job('IN_PROGRESS'), ctx('DISPATCHER')))).not.toContain('schedule');
    expect(keys(jobActions(job('EN_ROUTE'), ctx('DISPATCHER')))).not.toContain('assign');
  });

  it('needs somebody on the job before it can set off', () => {
    const action = jobActions(job('SCHEDULED', { assignments: [] }), ctx('DISPATCHER')).find((a) => a.to === 'EN_ROUTE');
    expect(action.disabledReason).toBe('Assign a technician first');
  });

  it('blocks completion while the checklist is open, and says how much is left', () => {
    const tasks = [{ id: 'a', isDone: true }, { id: 'b', isDone: false }, { id: 'c', isSkipped: true }, { id: 'd' }];
    const complete = jobActions(job('IN_PROGRESS', { tasks }), ctx('DISPATCHER')).find((a) => a.key === 'complete');
    expect(complete.disabledReason).toBe('2 checklist items are still open');
    expect(openTasks({ tasks }).map((t) => t.id)).toEqual(['b', 'd']);
    const done = jobActions(job('IN_PROGRESS', { tasks: [{ isDone: true }] }), ctx('DISPATCHER')).find((a) => a.key === 'complete');
    expect(done.disabledReason).toBeUndefined();
  });

  it('asks why before a hold or a cancel', () => {
    const actions = jobActions(job('IN_PROGRESS'), ctx('DISPATCHER'));
    expect(actions.find((a) => a.to === 'ON_HOLD')).toMatchObject({ note: true, noteRequired: true });
    expect(actions.find((a) => a.to === 'CANCELLED')).toMatchObject({ note: true, noteRequired: true, destructive: true });
  });

  it('offers verify, reopen and the case study on finished work — the case study to cms:write only', () => {
    expect(keys(jobActions(job('COMPLETED'), ctx('ADMIN')))).toEqual(['verify', 'status:IN_PROGRESS', 'publish']);
    expect(keys(jobActions(job('COMPLETED'), ctx('DISPATCHER')))).toEqual(['verify', 'status:IN_PROGRESS']);
    expect(keys(jobActions(job('VERIFIED', { project: { id: 'p1' } }), ctx('ADMIN')))).toEqual(['openCaseStudy']);
  });

  it('offers nothing to a role that only reads jobs', () => {
    expect(jobActions(job('DRAFT'), ctx('SALES'))).toEqual([]);
    expect(jobActions(job('COMPLETED'), ctx('ACCOUNTANT'))).toEqual([]);
  });
});

describe('jobWaitingFor', () => {
  it('says what the job is waiting for', () => {
    expect(jobWaitingFor(job('DRAFT', { assignments: [] }))).toBe('Waiting for a date and a technician');
    expect(jobWaitingFor(job('ON_HOLD', { holdReason: 'ग्राहक बाहिर' }))).toBe('On hold: ग्राहक बाहिर');
    expect(jobWaitingFor(job('VERIFIED', { isBillable: true }))).toBe('Verified — not invoiced yet');
  });
});

describe('siteMapHref', () => {
  it('uses the pin, else the address in Devanagari as typed', () => {
    expect(siteMapHref({ lat: 27.68, lng: 85.31, address: 'x' })).toBe('https://www.google.com/maps/search/?api=1&query=27.68,85.31');
    expect(siteMapHref({ address: 'झम्सिखेल', area: 'Lalitpur' }))
      .toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('झम्सिखेल, Lalitpur')}`);
    expect(siteMapHref({})).toBeNull();
    expect(siteMapHref(null)).toBeNull();
  });
});
