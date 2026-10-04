import { NEXT_ACTION_LABELS } from '@/config/constants';
import { TIMEZONE_OFFSET_MINUTES } from '@/config/locale';
import { addDays, monthGrid, shiftMonth, weekDays } from '@/helpers/calendarDays';
import { formatNpr, formatTime, kathmanduDay } from '@/helpers/format';
import { lateBy } from '@/helpers/leadFollowUp';

/**
 * The SLA board's calendar (`components/agenda/`), without a DOM: its kinds, views and items. The days themselves —
 * Kathmandu `YYYY-MM-DD` strings, AD or BS months — are `helpers/calendarDays.js`'s.
 */

const toMs = (day) => Date.parse(`${day}T00:00:00Z`);

/** Each kind: what it is, the shorter word a chip has room for, and its colour (a theme variable, `--tone`). */
export const AGENDA_KINDS = {
  response: { label: 'Reply deadline', short: 'Reply', tone: '--sla-warn' },
  followUp: { label: 'Follow-up', short: 'Follow-up', tone: '--info' },
  visit: { label: 'Site visit', short: 'Visit', tone: '--chart-1' },
  job: { label: 'Job', short: 'Job', tone: '--note-purple-edge' },
  quotation: { label: 'Quotation expiry', short: 'Quote', tone: '--note-pink-edge' },
  invoice: { label: 'Invoice due', short: 'Invoice', tone: '--success' },
  amcVisit: { label: 'AMC visit', short: 'AMC', tone: '--note-yellow-edge' },
  renewal: { label: 'AMC renewal', short: 'Renewal', tone: '--muted-foreground' },
};

/** The legend's order — the API's too. */
export const AGENDA_KIND_ORDER = Object.keys(AGENDA_KINDS);

/** The inline style that sets `--tone` for a kind; chips, dots and the legend read it. */
export const kindStyle = (kind) => ({ '--tone': `var(${AGENDA_KINDS[kind]?.tone ?? '--primary'})` });

/** The calendar's three ways of looking. */
export const AGENDA_VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'list', label: 'List' },
];

/**
 * The anchor one period on (`step` 1) or back (-1). A month step lands on the 1st, so 31 January never
 * skips February (nor 32 Ashadh a month).
 */
export function shiftAnchor(anchor, view, step, calendar = 'ad') {
  return view === 'week' ? addDays(anchor, 7 * step) : shiftMonth(anchor, step, calendar);
}

/** The days a view shows, as the API's `{ from, to }`: the week, or the month's whole six-week grid. */
export function spanFor(view, anchor, calendar = 'ad') {
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor, calendar);
  return { from: days[0], to: days[days.length - 1] };
}

/** The Kathmandu day an item sits on. */
export const itemDay = (item) => kathmanduDay(item.at);

/** A day's order: the all-day ones (due dates) first, then by the clock. */
export const byTime = (a, b) => Number(b.allDay) - Number(a.allDay) || new Date(a.at) - new Date(b.at) || a.kind.localeCompare(b.kind);

/**
 * Items by the Kathmandu day they sit on, each day in `byTime` order.
 *
 * @param {object[]} items
 * @returns {Map<string, object[]>}
 */
export function itemsByDay(items) {
  const days = new Map();
  for (const item of items) {
    const day = itemDay(item);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(item);
  }
  for (const list of days.values()) list.sort(byTime);
  return days;
}

/**
 * The board's Everyone / Mine / Unassigned switch, on the calendar. Mine is what the caller owns; Unassigned is the
 * ownable kinds (a lead's work, a quotation) with nobody on them — a job or an invoice is nobody's in this sense.
 *
 * @param {object[]} items
 * @param {'all'|'mine'|'unassigned'} scope
 * @param {string} [userId]
 */
export function itemsInScope(items, scope, userId) {
  if (scope === 'mine') return items.filter((i) => i.ownerId === userId);
  if (scope === 'unassigned') return items.filter((i) => i.ownable && !i.ownerId);
  return items;
}

/** The URL's `hide=job,invoice` → the kinds switched off, known kinds only. */
export const parseHidden = (value) => new Set(String(value ?? '').split(',').filter((k) => k in AGENDA_KINDS));

/** …and back: `undefined` when nothing is hidden, so the address stays clean. */
export const serializeHidden = (hidden) => (hidden.size ? AGENDA_KIND_ORDER.filter((k) => hidden.has(k)).join(',') : undefined);

/** How many of each kind, for the legend's counts. */
export function countByKind(items) {
  const counts = Object.fromEntries(AGENDA_KIND_ORDER.map((k) => [k, 0]));
  for (const item of items) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  return counts;
}

/**
 * The tiles over the calendar: what is late (all of it — the API always sends every late item), what falls today,
 * what is still coming in the days on screen, and how many ownable items nobody has.
 *
 * @param {object[]} items  already scoped and filtered
 * @param {{ from: string, to: string }} span
 * @param {string} today
 */
export function agendaSummary(items, span, today) {
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  let unowned = 0;
  for (const item of items) {
    if (item.ownable && !item.ownerId) unowned += 1;
    if (item.state === 'overdue') overdue += 1;
    else if (item.state === 'today') dueToday += 1;
    else {
      const day = itemDay(item);
      if (day >= span.from && day <= span.to && day >= today) upcoming += 1;
    }
  }
  return { overdue, today: dueToday, upcoming, unowned, todayInView: today >= span.from && today <= span.to };
}

/** "09:00", "10:00–12:00" (an end on the same day), or "All day" for a due date. */
export function itemTime(item) {
  if (item.allDay) return 'All day';
  const start = formatTime(item.at);
  if (!item.endAt || itemDay({ at: item.endAt }) !== itemDay(item)) return start;
  return `${start}–${formatTime(item.endAt)}`;
}

const QUOTE_WORDS = {
  OFFICE_APPROVED: 'Approved, not sent yet — valid until this day',
  SENT: 'With the customer — expires this day',
  CHANGES_REQUESTED: 'Customer asked for changes — expires this day',
};

/**
 * What to do, in a line: "Reply to the enquiry", "Call — Ask about the roof", "Site visit · Hari",
 * "Rs. 7,499.50 still owed".
 */
export function itemAction(item) {
  switch (item.kind) {
    case 'response': return 'First reply to the enquiry';
    case 'followUp': {
      const label = NEXT_ACTION_LABELS[item.type] ?? 'Follow up';
      return item.note ? `${label} — ${item.note}` : label;
    }
    case 'visit':
    case 'job': {
      const who = item.people?.length ? item.people.join(', ') : 'Nobody assigned yet';
      return `${item.kind === 'visit' ? 'Site visit' : 'Job'} · ${who}`;
    }
    case 'quotation': return QUOTE_WORDS[item.status] ?? 'Quotation expires this day';
    case 'invoice': return `${formatNpr(item.amount ?? 0)} still owed`;
    case 'amcVisit': return 'AMC visit due — book it';
    case 'renewal': return 'Contract ends — offer the renewal';
    default: return '';
  }
}

/**
 * How late an overdue item is: "45 min late", "3 h late", "12 d late". A due date is late from the end of its day.
 *
 * @param {object} item
 * @param {number} [now]
 * @returns {string|null}
 */
export function lateLabel(item, now = Date.now()) {
  if (item.state !== 'overdue') return null;
  const since = item.allDay
    ? toMs(addDays(itemDay(item), 1)) - TIMEZONE_OFFSET_MINUTES * 60_000
    : new Date(item.endAt && (item.kind === 'job' || item.kind === 'visit') ? item.endAt : item.at).getTime();
  return `${lateBy(Math.max(1, Math.floor((now - since) / 60_000)))} late`;
}
