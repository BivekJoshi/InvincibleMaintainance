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
