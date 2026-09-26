import {
  BUDGET_BAND_LABELS, DECISION_MAKER_LABELS, NEXT_ACTION_LABELS, PROPERTY_TYPE_LABELS,
} from '@/config/constants';
import { toKathmanduParts } from '@/helpers/format';

/**
 * A lead's follow-through, without a DOM (Phase L1): what is next and whether it is late, how long
 * the lead has sat in its stage, and what its qualification still lacks. Times are shown in Kathmandu; "today" is Kathmandu's calendar
 * day. The board's drop rules are in `helpers/leadBoard.js`.
 */

/** Statuses that are finished: no next action, no clock. */
export const CLOSED_STATUSES = ['WON', 'LOST'];

export const isClosedLead = (lead) => CLOSED_STATUSES.includes(lead?.status);

const DAY_MS = 86_400_000;
const ktmDate = (ms) => toKathmanduParts(new Date(ms).toISOString()).date;

/**
 * Whole days (rounded down) the lead has been in its current status.
 *
 * @param {{ stageEnteredAt?: string }} lead
 * @param {number} [now]  ms since the epoch
 * @returns {number|null} null when the API sent no `stageEnteredAt`
 */
export function daysInStage(lead, now = Date.now()) {
  const since = new Date(lead?.stageEnteredAt ?? NaN).getTime();
  if (!Number.isFinite(since)) return null;
  return Math.max(0, Math.floor((now - since) / DAY_MS));
}

/** The chip's words: "4d in stage", or "In stage today" for a lead that moved today. */
export const stageAgeLabel = (days) => (days ? `${days}d in stage` : 'In stage today');

/** "45 min", "3 h", "2 d" — how late something is. */
export function lateBy(minutes) {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (60 * 24))} d`;
}

/**
 * When, in Kathmandu words: "Today, 14:30", "Tomorrow, 10:00", "Yesterday, 09:00", or "Mon 28 Sep, 10:00"
 * (with the year when it is not this year's).
 *
 * @param {string} iso
 * @param {number} [now]
 */
export function formatWhen(iso, now = Date.now()) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '—';
  const { date, time } = toKathmanduParts(new Date(at).toISOString());
  const today = ktmDate(now);
  const named = {
    [today]: 'Today',
    [ktmDate(now + DAY_MS)]: 'Tomorrow',
    [ktmDate(now - DAY_MS)]: 'Yesterday',
  }[date];
  if (named) return `${named}, ${time}`;
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
  return `${day}, ${time}`;
}

/**
 * Where a lead's next action stands.
 *
 * - `null` — a closed lead (WON / LOST): nothing is next.
 * - `{ state: 'none' }` — an open lead with no next action (the "No next action" view).
 * - `{ state: 'overdue' | 'today' | 'later', at, type, label, note, when, lateMinutes }`.
 *
 * @param {{ status: string, nextActionAt?: string|null, nextActionType?: string|null, nextActionNote?: string|null }} lead
 * @param {number} [now]
 */
export function nextActionState(lead, now = Date.now()) {
  if (!lead || isClosedLead(lead)) return null;
  const at = lead.nextActionAt ? new Date(lead.nextActionAt).getTime() : NaN;
  if (!Number.isFinite(at)) return { state: 'none' };
  const lateMinutes = Math.floor((now - at) / 60_000);
  let state = 'later';
  if (at < now) state = 'overdue';
  else if (ktmDate(at) === ktmDate(now)) state = 'today';
  return {
    state,
    at: lead.nextActionAt,
    type: lead.nextActionType ?? null,
    label: NEXT_ACTION_LABELS[lead.nextActionType] ?? 'Follow up',
    note: lead.nextActionNote || null,
    when: formatWhen(lead.nextActionAt, now),
    lateMinutes: state === 'overdue' ? lateMinutes : 0,
  };
}

/**
 * What the qualification card (`components/leads/QualificationCard`) asks for, in order, with the words for "missing". Floors and building age mean
 * nothing on bare land, so a plot is not asked for them.
 */
const PARTS = [
  { key: 'propertyType', label: 'Property', missing: 'property type', show: (v) => PROPERTY_TYPE_LABELS[v] ?? v },
  { key: 'floors', label: 'Floors', missing: 'floors', show: (v) => String(v), skip: (q) => q.propertyType === 'land' },
  {
    key: 'buildingAgeYears', label: 'Building age', missing: 'building age',
    show: (v) => (v === 0 ? 'New build' : `${v} year${v === 1 ? '' : 's'}`), skip: (q) => q.propertyType === 'land',
  },
  { key: 'budgetBand', label: 'Budget', missing: 'budget', show: (v) => BUDGET_BAND_LABELS[v] ?? v },
  { key: 'decisionMaker', label: 'Who decides', missing: 'decision maker', show: (v) => DECISION_MAKER_LABELS[v] ?? v },
];

const known = (v) => v !== undefined && v !== null && v !== '';

/**
 * What is filled and what is still missing, from `lead.qualification`.
 *
 * @param {object|null} qualification
 * @returns {{ filled: { key: string, label: string, value: string }[], missing: string[] }}
 */
export function qualificationSummary(qualification) {
  const q = qualification ?? {};
  const asked = PARTS.filter((p) => !p.skip?.(q));
  return {
    filled: asked.filter((p) => known(q[p.key])).map((p) => ({ key: p.key, label: p.label, value: p.show(q[p.key]) })),
    missing: asked.filter((p) => !known(q[p.key])).map((p) => p.missing),
  };
}
