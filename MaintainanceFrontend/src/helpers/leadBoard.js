import { LEAD_STATUSES, LEAD_TRANSITIONS } from '@/config/constants';

/** Where a lead in `status` may go next, in funnel order. */
export const nextStatuses = (status) => LEAD_TRANSITIONS[status] ?? [];

/**
 * Whether a card may be dropped on a column. Dropping back on its own column is not a
 * move; everything else is exactly what the state machine allows.
 *
 * @param {string} from  the card's status
 * @param {string} to    the column's status
 */
export const canDrop = (from, to) => Boolean(from && to) && from !== to && nextStatuses(from).includes(to);

/** A move that needs more than the drop: LOST asks why. */
export const needsReason = (to) => to === 'LOST';

/** The board's columns: every status, in funnel order. */
export const BOARD_COLUMNS = LEAD_STATUSES;

/** Columns folded by default: closed leads need no work, but stay a drop target (a lead is lost from anywhere). */
export const FOLDABLE_COLUMNS = ['WON', 'LOST'];

/** Each stage's colour — a theme variable, so it follows light and dark. */
const STATUS_TONES = {
  NEW: '--info',
  CONTACTED: '--chart-1',
  INSPECTION_SCHEDULED: '--gold',
  QUOTED: '--note-purple-edge',
  WON: '--success',
  LOST: '--destructive',
};

/** The inline style that sets `--tone` for a status; the column, its cards and the drag overlay read it. */
export const toneStyle = (status) => ({ '--tone': `var(${STATUS_TONES[status] ?? '--primary'})` });

/**
 * The status each card is shown under: the server's, unless a move is in flight.
 *
 * @param {object[]} leads
 * @param {Record<string, string>} pending  lead id → the status it is being moved to
 * @param {string} column
 */
export function cardsForColumn(leads, pending, column) {
  return leads.filter((lead) => (pending[lead.id] ?? lead.status) === column);
}

/**
 * "34 min — within the promise" / "2 h 5 min — after the deadline": what logging the
 * first contact did to the response clock.
 *
 * @param {{ state: string, dueAt?: string, respondedAt?: string }} sla
 * @param {string} createdAt  the lead's
 * @returns {string|null}
 */
export function responseResult(sla, createdAt) {
  if (!sla?.respondedAt || !createdAt) return null;
  const minutes = Math.max(0, Math.round((new Date(sla.respondedAt) - new Date(createdAt)) / 60000));
  const took = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  return sla.state === 'met' ? `Responded in ${took} — within the promise` : `Responded in ${took} — after the deadline`;
}

/**
 * The leads table showing what a column holds — its "+N more" link. The board's query
 * uses `assignedToId=me` for My leads; the table says that with `view=mine`.
 *
 * @param {object} query  the board's API query (without paging)
 * @param {string} status
 */
export function columnTableHref(query, status) {
  const { assignedToId, ...rest } = query;
  const params = {
    ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null && v !== '')),
    ...(assignedToId === 'me' ? { view: 'mine' } : { view: 'all', ...(assignedToId ? { assignedToId } : {}) }),
    status,
  };
  return `/admin/leads?${new URLSearchParams(params)}`;
}

/** Who a lead can be given to — the API's ASSIGNABLE_ROLES. Only they can take a lead. */
export const ASSIGNABLE_ROLES = ['SALES', 'MANAGER', 'ADMIN'];

/** The SLA board's "whose" switch. */
export const SLA_SCOPES = [
  { value: 'all', label: 'Everyone' },
  { value: 'mine', label: 'Mine' },
  { value: 'unassigned', label: 'Unassigned' },
];

/**
 * The SLA board's leads for a scope. The board holds at most fifty per column, so this
 * filters in the browser instead of asking the API again.
 *
 * @param {object[]} leads
 * @param {'all'|'mine'|'unassigned'} scope
 * @param {string} [userId]
 */
export function leadsInScope(leads, scope, userId) {
  if (scope === 'mine') return leads.filter((l) => (l.assignedToId ?? l.assignedTo?.id) === userId);
  if (scope === 'unassigned') return leads.filter((l) => !(l.assignedToId ?? l.assignedTo?.id));
  return leads;
}

/**
 * How far a waiting lead is through its response window, for the SLA board's bar: `ratio`
 * 0–1 of the window used, and `overdueMinutes` once the deadline has passed.
 *
 * @param {{ createdAt: string, sla?: { dueAt?: string } }} lead
 * @param {number} [now]  ms since the epoch
 * @returns {{ ratio: number, overdueMinutes: number }|null}
 */
export function slaProgress(lead, now = Date.now()) {
  const start = new Date(lead?.createdAt).getTime();
  const due = new Date(lead?.sla?.dueAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null;
  const ratio = Math.min(1, Math.max(0, (now - start) / (due - start)));
  return { ratio, overdueMinutes: Math.max(0, Math.round((now - due) / 60000)) };
}

/** Statuses still being worked. */
export const OPEN_STATUSES = ['NEW', 'CONTACTED', 'INSPECTION_SCHEDULED', 'QUOTED'];

/** An open lead this many days old or more is going cold. */
export const COLD_AFTER_DAYS = 7;

/** Whole days since a lead came in. */
export const leadAgeDays = (lead, now = Date.now()) => Math.max(0, Math.floor((now - new Date(lead.createdAt).getTime()) / 86_400_000));

/** An open lead left too long: the board flags it before it is lost by default. */
export const isGoingCold = (lead, now = Date.now()) => OPEN_STATUSES.includes(lead.status) && leadAgeDays(lead, now) >= COLD_AFTER_DAYS;

/**
 * The pipeline's summary from each column's total: how many leads, how many still open,
 * each stage's share, and the win rate of the closed ones (null until one has closed).
 *
 * @param {Record<string, number>} totals  status → the column's total
 */
export function funnelSummary(totals) {
  const count = (s) => totals[s] ?? 0;
  const total = LEAD_STATUSES.reduce((n, s) => n + count(s), 0);
  const closed = count('WON') + count('LOST');
  return {
    total,
    open: OPEN_STATUSES.reduce((n, s) => n + count(s), 0),
    winRate: closed ? Math.round((count('WON') / closed) * 100) : null,
    shares: Object.fromEntries(LEAD_STATUSES.map((s) => [s, total ? Math.round((count(s) / total) * 100) : 0])),
  };
}

/** On the response runway the promise takes this share of the track; the rest is the first hour past it. */
export const RUNWAY_PROMISE_SHARE = 0.8;
/** How far past the deadline the runway draws before it pins a lead to its end. */
export const RUNWAY_OVERFLOW_MINUTES = 60;
/** The last stretch before the deadline — the API's `sla.warnBeforeMinutes` default. */
export const RUNWAY_WARN_MINUTES = 30;

/**
 * Where a waiting lead sits on the response runway: `x` 0–1 along the track, its `zone`,
 * the minutes left (negative once late) and whether it is `pinned` at the far end
 * because it is later than the track draws.
 *
 * @param {{ createdAt: string, sla?: { dueAt?: string } }} lead
 * @param {number} [now]  ms since the epoch
 * @returns {{ x: number, zone: 'ok'|'warn'|'breach', minutesLeft: number, pinned: boolean }|null}
 */
export function runwayPoint(lead, now = Date.now(), warnMinutes = RUNWAY_WARN_MINUTES) {
  const start = new Date(lead?.createdAt).getTime();
  const due = new Date(lead?.sla?.dueAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null;
  const windowMinutes = (due - start) / 60000;
  const elapsed = Math.max(0, (now - start) / 60000);
  const minutesLeft = Math.round(windowMinutes - elapsed);
  if (elapsed <= windowMinutes) {
    return {
      x: (elapsed / windowMinutes) * RUNWAY_PROMISE_SHARE,
      zone: windowMinutes - elapsed <= warnMinutes ? 'warn' : 'ok',
      minutesLeft,
      pinned: false,
    };
  }
  const late = elapsed - windowMinutes;
  return {
    x: RUNWAY_PROMISE_SHARE + Math.min(1, late / RUNWAY_OVERFLOW_MINUTES) * (1 - RUNWAY_PROMISE_SHARE),
    zone: 'breach',
    minutesLeft,
    pinned: late > RUNWAY_OVERFLOW_MINUTES,
  };
}

/**
 * Stacks runway markers so neighbours do not cover each other: each point takes the lowest
 * lane whose last marker is at least `gap` behind it, and past `maxLanes` shares the lane
 * that frees up first. Returns the points sorted by `x`, each with its `lane`.
 *
 * @template {{ x: number }} P
 * @param {P[]} points
 * @returns {(P & { lane: number })[]}
 */
export function runwayLanes(points, gap = 0.035, maxLanes = 4) {
  const ends = [];
  return [...points].sort((a, b) => a.x - b.x).map((point) => {
    let lane = ends.findIndex((end) => point.x - end >= gap);
    if (lane === -1) lane = ends.length < maxLanes ? ends.length : ends.indexOf(Math.min(...ends));
    ends[lane] = point.x;
    return { ...point, lane };
  });
}
