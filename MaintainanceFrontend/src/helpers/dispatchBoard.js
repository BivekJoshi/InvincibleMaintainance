import { fromKathmanduParts, toKathmanduParts } from '@/helpers/format';

/**
 * The dispatch board's rules, without a DOM: Kathmandu days and hours, where a dropped job
 * lands, and what would be wrong with it landing there. The API applies the same conflict and
 * capacity rules after a move (`meta.warnings`); the board runs these **before** it sends, so a
 * dispatcher is warned while the move can still be called off.
 */

export const DEFAULT_DURATION_MINUTES = 120;
/** The time a job dropped on a whole day (week view) starts, when it had no time before. */
export const DEFAULT_START = '10:00';

const pad = (n) => String(n).padStart(2, '0');
const MINUTE = 60_000;

/** Kathmandu's calendar day for an instant, `YYYY-MM-DD`. */
export const ktmDay = (instant = new Date()) => toKathmanduParts(new Date(instant).toISOString()).date;

/** A `YYYY-MM-DD` day moved by `n` days. */
export function addDaysTo(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The day the board shows after "previous" / "next": a day or a week at a time. */
export const shiftBoardDate = (day, view, direction) => addDaysTo(day, (view === 'week' ? 7 : 1) * direction);

/** `{ start: 8, end: 18 }` → `[8, 9, …, 17]`, one column per hour. */
export const hoursOf = ({ start, end }) => Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);

export const hourLabel = (hour) => `${pad(hour)}:00`;

/** How long a job is booked for, in minutes (two hours when it has no window yet). */
export function durationOf(job) {
  if (!job?.scheduledStart || !job?.scheduledEnd) return DEFAULT_DURATION_MINUTES;
  const minutes = Math.round((new Date(job.scheduledEnd) - new Date(job.scheduledStart)) / MINUTE);
  return minutes > 0 ? minutes : DEFAULT_DURATION_MINUTES;
}

/** A window from a Kathmandu day and time and a length. */
export function windowAt(day, time, minutes) {
  const scheduledStart = fromKathmanduParts(day, time);
  if (!scheduledStart) return null;
  return {
    scheduledStart,
    scheduledEnd: new Date(new Date(scheduledStart).getTime() + minutes * MINUTE).toISOString(),
  };
}

/**
 * Where a job dropped on a cell lands. An hour cell (day view) starts it on that hour; a day
 * cell (week view) keeps the time of day it had, or starts it at 10:00. The length is kept.
 *
 * @param {object} job
 * @param {{ day: string, hour?: number }} target
 */
export function dropWindow(job, { day, hour }) {
  const time = hour != null
    ? hourLabel(hour)
    : (job.scheduledStart ? toKathmanduParts(job.scheduledStart).time : DEFAULT_START);
  return windowAt(day, time, durationOf(job));
}

/** A job's technician ids, the lead first. */
export const crewOf = (job) => [...(job.assignments ?? [])]
  .sort((a, b) => Number(b.isLead) - Number(a.isLead))
  .map((a) => a.technicianId);

/**
 * The technician ids a job lands with when dropped on a lane. Dropped within its own lane, the
 * crew is unchanged. Dragged from one person's lane to another's, that person is swapped for the
 * other, who leads. From the queue, the lane's person leads and anyone already on it stays.
 *
 * @param {object} job
 * @param {string} technicianId  the lane it was dropped on
 * @param {string|null} [fromTechnicianId]  the lane it was dragged from (null for the queue)
 */
export function dropTechnicians(job, technicianId, fromTechnicianId = null) {
  const current = crewOf(job);
  if (fromTechnicianId === technicianId) return current;
  return [technicianId, ...current.filter((id) => id !== technicianId && id !== fromTechnicianId)];
}

/** Whether a drop changes nothing: the same people in the same order, the same window. */
export function isSameDrop(job, window, technicianIds) {
  const current = crewOf(job);
  return job.scheduledStart && new Date(job.scheduledStart).getTime() === new Date(window.scheduledStart).getTime()
    && current.length === technicianIds.length && current.every((id, i) => id === technicianIds[i]);
}

/** Does this job start on that Kathmandu day (and hour)? */
export function startsIn(job, day, hour) {
  if (!job.scheduledStart) return false;
  const { date, time } = toKathmanduParts(job.scheduledStart);
  if (date !== day) return false;
  return hour == null || Number(time.slice(0, 2)) === hour;
}

/**
 * A lane's jobs for one cell. The first hour column also holds jobs that start before the
 * working day, and the last those that start after it, so nothing on the day is hidden.
 */
export function jobsInCell(jobs, day, hour, hours) {
  return jobs.filter((job) => {
    if (!startsIn(job, day)) return false;
    if (hour == null) return true;
    const h = Number(toKathmanduParts(job.scheduledStart).time.slice(0, 2));
    if (h === hour) return true;
    if (hours && hour === hours.start && h < hours.start) return true;
    return Boolean(hours && hour === hours.end - 1 && h >= hours.end);
  });
}

const overlaps = (a, b) => new Date(a.scheduledStart) < new Date(b.scheduledEnd)
  && new Date(b.scheduledStart) < new Date(a.scheduledEnd);

/**
 * What would be wrong with `job` happening in `window`, done by `technicianIds`, judged from the
 * board's lanes: an overlap with another of a technician's jobs, a day past their capacity, a
 * technician marked unavailable. A day the board is not showing cannot be judged here — the
 * result says `unchecked`, and the API's own warnings come back after the move.
 *
 * @param {{ job: object, window: { scheduledStart: string, scheduledEnd: string }, technicianIds: string[],
 *   lanes: object[], days?: string[] }} input
 * @returns {{ warnings: { kind: 'conflict'|'capacity'|'unavailable', technicianId: string, technician: string,
 *   day?: string, with?: string, load?: number, capacity?: number }[], unchecked: boolean }}
 */
export function scheduleWarnings({ job, window, technicianIds, lanes, days }) {
  const day = ktmDay(window.scheduledStart);
  const unchecked = Boolean(days && !days.includes(day));
  const warnings = [];
  for (const technicianId of technicianIds) {
    const lane = lanes.find((l) => l.technician.id === technicianId);
    if (!lane) continue;
    const { technician } = lane;
    if (technician.isAvailable === false) {
      warnings.push({ kind: 'unavailable', technicianId, technician: technician.name });
    }
    if (unchecked) continue;
    const others = lane.jobs.filter((j) => j.id !== job.id && j.scheduledStart);
    for (const other of others) {
      if (other.scheduledEnd && overlaps(window, other)) {
        warnings.push({
          kind: 'conflict', technicianId, technician: technician.name, day, with: other.number,
          from: other.scheduledStart, to: other.scheduledEnd,
        });
      }
    }
    const load = others.filter((j) => ktmDay(j.scheduledStart) === day).length + 1;
    if (load > technician.dailyCapacity) {
      warnings.push({ kind: 'capacity', technicianId, technician: technician.name, day, load, capacity: technician.dailyCapacity });
    }
  }
  return { warnings, unchecked };
}

const dayWords = (day) => new Date(`${day}T00:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeOf = (iso) => toKathmanduParts(iso).time;

/** One warning as a sentence, for the confirm dialog and the toast. */
export function warningText(w) {
  switch (w.kind) {
    case 'conflict':
      return `${w.technician} already has ${w.with}${w.from ? ` ${timeOf(w.from)}–${timeOf(w.to)}` : ''} on ${dayWords(w.day)}.`;
    case 'capacity':
      return `${w.technician} would have ${w.load} jobs on ${dayWords(w.day)} — their limit is ${w.capacity}.`;
    case 'unavailable':
      return `${w.technician} is marked unavailable.`;
    default:
      return '';
  }
}

/** Skills and service areas across the lanes, for the board's filters. */
export function laneOptions(lanes = []) {
  const collect = (key) => [...new Set(lanes.flatMap((l) => l.technician[key] ?? []))].sort((a, b) => a.localeCompare(b));
  return { skills: collect('skills'), areas: collect('serviceAreas') };
}

/** The lanes a skill / area filter keeps. */
export function filterLanes(lanes = [], { skill, area } = {}) {
  return lanes.filter((l) => (!skill || (l.technician.skills ?? []).includes(skill))
    && (!area || (l.technician.serviceAreas ?? []).includes(area)));
}

/** A job card's time, in Kathmandu: `10:00–12:00`. */
export const windowLabel = (job) => (job.scheduledStart
  ? `${timeOf(job.scheduledStart)}${job.scheduledEnd ? `–${timeOf(job.scheduledEnd)}` : ''}`
  : 'No time yet');

/** A job card's colour per status — a theme variable, so it follows light and dark. */
const JOB_STATUS_TONES = {
  DRAFT: '--muted-foreground',
  SCHEDULED: '--info',
  ASSIGNED: '--chart-1',
  EN_ROUTE: '--gold',
  IN_PROGRESS: '--warning',
  ON_HOLD: '--destructive',
  COMPLETED: '--success',
  VERIFIED: '--success',
  CANCELLED: '--muted-foreground',
};

/** The inline style that sets `--tone` for a job's status; the card and the drag overlay read it. */
export const jobToneStyle = (status) => ({ '--tone': `var(${JOB_STATUS_TONES[status] ?? '--primary'})` });

/** A technician's avatar colour, the same for them on every visit. */
const PERSON_TONES = ['--info', '--chart-1', '--gold', '--note-purple-edge', '--success', '--note-pink-edge'];
export function personToneStyle(id = '') {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { '--tone': `var(${PERSON_TONES[hash % PERSON_TONES.length]})` };
}

/**
 * The strip above the board: who is on it, the jobs it holds (a crew job counted once),
 * how full the days are, and the clashes.
 *
 * @param {{ days: string[], unassignedCount?: number }} board
 * @param {object[]} lanes  the lanes on show
 */
export function boardStats(board, lanes = []) {
  const jobs = new Set(lanes.flatMap((l) => l.jobs.map((j) => j.id)));
  let load = 0;
  let capacity = 0;
  for (const lane of lanes) {
    for (const day of board.days) {
      load += lane.loadByDay?.[day] ?? 0;
      capacity += lane.technician.dailyCapacity ?? 0;
    }
  }
  return {
    people: lanes.length,
    jobs: jobs.size,
    unassigned: board.unassignedCount ?? 0,
    clashes: lanes.reduce((n, l) => n + (l.conflicts?.length ?? 0), 0),
    utilisation: capacity ? Math.round((load / capacity) * 100) : 0,
  };
}

/** Kathmandu's hour right now, 0–23. */
export const ktmHour = (instant = new Date()) => Number(toKathmanduParts(new Date(instant).toISOString()).time.slice(0, 2));

/** Saturday — the day off in Nepal. */
export const isDayOff = (day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 6;
