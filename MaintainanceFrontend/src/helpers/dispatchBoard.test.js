import { describe, expect, it } from 'vitest';
import {
  addDaysTo, dropTechnicians, dropWindow, isSameDrop, durationOf, filterLanes, hoursOf, jobsInCell, ktmDay, laneOptions,
  scheduleWarnings, shiftBoardDate, warningText, windowAt, windowLabel,
} from '@/helpers/dispatchBoard';

/** An instant on a Kathmandu day at a Kathmandu time. */
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:45`).toISOString();
const DAY = '2026-09-18';

const job = (id, number, day, from, to, technicianIds = []) => ({
  id, number,
  scheduledStart: from ? at(day, from) : null,
  scheduledEnd: to ? at(day, to) : null,
  assignments: technicianIds.map((technicianId, i) => ({ technicianId, isLead: i === 0 })),
});

const lane = (id, name, jobs, { dailyCapacity = 2, isAvailable = true, skills = [], serviceAreas = [] } = {}) => ({
  technician: { id, name, dailyCapacity, isAvailable, skills, serviceAreas },
  jobs,
});

describe('Kathmandu days and hours', () => {
  it('reads the office’s day, not the browser’s or UTC’s', () => {
    // 00:30 on the 18th in Kathmandu is still the 17th in UTC.
    expect(ktmDay(at(DAY, '00:30'))).toBe(DAY);
    expect(ktmDay(at(DAY, '23:50'))).toBe(DAY);
  });

  it('moves a day or a week, across month ends', () => {
    expect(addDaysTo('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftBoardDate(DAY, 'day', -1)).toBe('2026-09-17');
    expect(shiftBoardDate(DAY, 'week', 1)).toBe('2026-09-25');
  });

  it('lists the working hours as columns', () => {
    expect(hoursOf({ start: 8, end: 11 })).toEqual([8, 9, 10]);
  });

  it('builds a window at a quarter-hour offset', () => {
    expect(windowAt(DAY, '10:00', 90)).toEqual({
      scheduledStart: '2026-09-18T04:15:00.000Z', scheduledEnd: '2026-09-18T05:45:00.000Z',
    });
  });
});

describe('where a dropped job lands', () => {
  it('keeps the length, starting on the hour it was dropped on', () => {
    const long = job('j1', 'JOB-1', '2026-09-20', '09:00', '12:30');
    expect(durationOf(long)).toBe(210);
    const w = dropWindow(long, { day: DAY, hour: 14 });
    expect(w).toEqual({ scheduledStart: at(DAY, '14:00'), scheduledEnd: at(DAY, '17:30') });
  });

  it('keeps the time of day on a day cell, or starts an unscheduled job at 10:00 for two hours', () => {
    expect(dropWindow(job('j1', 'JOB-1', '2026-09-20', '15:30', '16:00'), { day: DAY }).scheduledStart).toBe(at(DAY, '15:30'));
    expect(dropWindow(job('j2', 'JOB-2'), { day: DAY })).toEqual({ scheduledStart: at(DAY, '10:00'), scheduledEnd: at(DAY, '12:00') });
  });

  it('from the queue, makes the lane’s technician the lead and keeps the rest', () => {
    expect(dropTechnicians(job('j', 'J', DAY, null, null, ['a', 'b']), 'b')).toEqual(['b', 'a']);
    expect(dropTechnicians(job('j', 'J', DAY, null, null, ['a']), 'c')).toEqual(['c', 'a']);
    expect(dropTechnicians(job('j', 'J'), 'c')).toEqual(['c']);
  });

  it('between lanes, swaps the person; within a lane, keeps the crew', () => {
    const crew = job('j', 'J', DAY, '10:00', '11:00', ['a', 'b']);
    expect(dropTechnicians(crew, 'c', 'b')).toEqual(['c', 'a']);
    expect(dropTechnicians(crew, 'b', 'a')).toEqual(['b']);
    expect(dropTechnicians(crew, 'b', 'b')).toEqual(['a', 'b']);
  });

  it('knows a drop that changes nothing', () => {
    const crew = job('j', 'J', DAY, '10:00', '11:00', ['a']);
    expect(isSameDrop(crew, windowAt(DAY, '10:00', 60), ['a'])).toBe(true);
    expect(isSameDrop(crew, windowAt(DAY, '11:00', 60), ['a'])).toBe(false);
    expect(isSameDrop(crew, windowAt(DAY, '10:00', 60), ['b'])).toBe(false);
    expect(isSameDrop(job('u', 'U'), windowAt(DAY, '10:00', 60), [])).toBeFalsy();
  });

  it('puts each job in its hour, and early or late ones at the edges of the day', () => {
    const jobs = [
      job('early', 'E', DAY, '06:30', '07:30'),
      job('ten', 'T', DAY, '10:15', '11:00'),
      job('late', 'L', DAY, '19:00', '20:00'),
      job('other', 'O', '2026-09-19', '10:00', '11:00'),
    ];
    const hours = { start: 8, end: 18 };
    expect(jobsInCell(jobs, DAY, 8, hours).map((j) => j.id)).toEqual(['early']);
    expect(jobsInCell(jobs, DAY, 10, hours).map((j) => j.id)).toEqual(['ten']);
    expect(jobsInCell(jobs, DAY, 17, hours).map((j) => j.id)).toEqual(['late']);
    expect(jobsInCell(jobs, DAY, undefined, hours).map((j) => j.id)).toEqual(['early', 'ten', 'late']);
  });
});

describe('scheduleWarnings — the conflict and capacity rules', () => {
  const booked = job('b1', 'JOB-2083-0012', DAY, '10:00', '12:00', ['hari']);
  const lanes = [
    lane('hari', 'Hari KC', [booked], { dailyCapacity: 2 }),
    lane('sita', 'सीता राई', [], { isAvailable: false }),
  ];
  const moving = job('m1', 'JOB-2083-0020');

  it('warns about an overlapping window, naming the job and its time', () => {
    const { warnings, unchecked } = scheduleWarnings({
      job: moving, window: windowAt(DAY, '11:00', 120), technicianIds: ['hari'], lanes, days: [DAY],
    });
    expect(unchecked).toBe(false);
    expect(warnings).toEqual([expect.objectContaining({ kind: 'conflict', technician: 'Hari KC', with: 'JOB-2083-0012', day: DAY })]);
    expect(warningText(warnings[0])).toBe('Hari KC already has JOB-2083-0012 10:00–12:00 on Fri 18 Sept.');
  });

  it('treats back-to-back windows as fine', () => {
    const { warnings } = scheduleWarnings({ job: moving, window: windowAt(DAY, '12:00', 60), technicianIds: ['hari'], lanes });
    expect(warnings).toEqual([]);
  });

  it('warns when a day goes past the daily capacity', () => {
    const busy = [lane('hari', 'Hari KC', [booked, job('b2', 'JOB-2', DAY, '14:00', '15:00', ['hari'])], { dailyCapacity: 2 })];
    const { warnings } = scheduleWarnings({ job: moving, window: windowAt(DAY, '16:00', 60), technicianIds: ['hari'], lanes: busy });
    expect(warnings).toEqual([expect.objectContaining({ kind: 'capacity', load: 3, capacity: 2, day: DAY })]);
    expect(warningText(warnings[0])).toBe('Hari KC would have 3 jobs on Fri 18 Sept — their limit is 2.');
  });

  it('does not count the job against itself when it moves within its own day', () => {
    const full = [lane('hari', 'Hari KC', [booked], { dailyCapacity: 1 })];
    const { warnings } = scheduleWarnings({ job: booked, window: windowAt(DAY, '11:00', 120), technicianIds: ['hari'], lanes: full });
    expect(warnings).toEqual([]);
  });

  it('checks every technician on the job, and says who is unavailable in Devanagari as written', () => {
    const { warnings } = scheduleWarnings({
      job: moving, window: windowAt(DAY, '10:30', 30), technicianIds: ['hari', 'sita'], lanes,
    });
    expect(warnings.map((w) => w.kind)).toEqual(['conflict', 'unavailable']);
    expect(warningText(warnings[1])).toBe('सीता राई is marked unavailable.');
  });

  it('cannot judge a day the board is not showing', () => {
    const { warnings, unchecked } = scheduleWarnings({
      job: moving, window: windowAt('2026-10-01', '10:00', 120), technicianIds: ['hari'], lanes, days: [DAY],
    });
    expect(unchecked).toBe(true);
    expect(warnings).toEqual([]);
  });
});

describe('filters and labels', () => {
  const lanes = [
    lane('a', 'A', [], { skills: ['plumbing', 'waterproofing'], serviceAreas: ['ललितपुर'] }),
    lane('b', 'B', [], { skills: ['electrical'], serviceAreas: ['Kathmandu'] }),
  ];

  it('offers every skill and area once, sorted', () => {
    expect(laneOptions(lanes)).toEqual({ skills: ['electrical', 'plumbing', 'waterproofing'], areas: ['Kathmandu', 'ललितपुर'] });
  });

  it('keeps the lanes a filter matches', () => {
    expect(filterLanes(lanes, { skill: 'plumbing' }).map((l) => l.technician.id)).toEqual(['a']);
    expect(filterLanes(lanes, { area: 'Kathmandu' }).map((l) => l.technician.id)).toEqual(['b']);
    expect(filterLanes(lanes, {})).toHaveLength(2);
  });

  it('labels a card’s window in Kathmandu time', () => {
    expect(windowLabel(job('j', 'J', DAY, '09:45', '11:15'))).toBe('09:45–11:15');
    expect(windowLabel(job('j', 'J'))).toBe('No time yet');
  });
});
