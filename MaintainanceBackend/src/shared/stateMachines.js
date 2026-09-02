/**
 * Allowed status transitions. Enforced in the service layer — a status string from a
 * client is never trusted.
 */
export const LEAD_TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['INSPECTION_SCHEDULED', 'QUOTED', 'WON', 'LOST'],
  INSPECTION_SCHEDULED: ['QUOTED', 'WON', 'LOST'],
  QUOTED: ['WON', 'LOST'],
  WON: [],
  LOST: ['CONTACTED'],
};

export const QUOTATION_TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['APPROVED', 'REJECTED', 'EXPIRED'],
  APPROVED: ['CONVERTED'],
  REJECTED: ['SENT'],
  EXPIRED: ['SENT'],
  CONVERTED: [],
};

export const JOB_TRANSITIONS = {
  DRAFT: ['SCHEDULED', 'ASSIGNED', 'CANCELLED'],
  SCHEDULED: ['ASSIGNED', 'EN_ROUTE', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  COMPLETED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: [],
  CANCELLED: [],
};

export const INVOICE_TRANSITIONS = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
  PARTIAL: ['PAID', 'OVERDUE', 'VOID'],
  OVERDUE: ['PARTIAL', 'PAID', 'VOID'],
  PAID: ['VOID'],
  VOID: [],
};

export function canTransition(machine, from, to) {
  if (from === to) return true;
  return (machine[from] ?? []).includes(to);
}

export function assertTransition(machine, from, to, label = 'record') {
  if (!canTransition(machine, from, to)) {
    const allowed = (machine[from] ?? []).join(', ') || 'none';
    const err = new Error(`Cannot move ${label} from ${from} to ${to}. Allowed: ${allowed}`);
    err.status = 422;
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
}
