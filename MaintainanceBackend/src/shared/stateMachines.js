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

/**
 * No quotation reaches the customer without internal approval: DRAFT is submitted,
 * a MANAGER or ADMIN approves it (never their own while quotation.makerChecker is on),
 * or it auto-approves inside the submit when its total is below
 * quotation.autoApproveBelow — still by way of PENDING_APPROVAL. APPROVED means the
 * *customer* accepted, and becomes CONVERTED in the same transaction that creates the
 * job. A customer's answer, a decline or an expiry is final for that version; the way
 * on is a revision, which supersedes it with a new DRAFT that is approved again.
 */
export const QUOTATION_TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['OFFICE_APPROVED', 'DRAFT'],
  OFFICE_APPROVED: ['SENT', 'DRAFT'],
  SENT: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
  CHANGES_REQUESTED: ['SUPERSEDED'],
  REJECTED: ['SUPERSEDED'],
  EXPIRED: ['SUPERSEDED'],
  APPROVED: ['CONVERTED'],
  SUPERSEDED: [],
  CONVERTED: [],
};

/**
 * RETURNED is a first-class state: the surveyor is the only person who stood on the
 * site, so "you missed the west-wall reading" has to be a round trip, not a phone call.
 */
export const SURVEY_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'RETURNED', 'QUOTED', 'CANCELLED'],
  IN_REVIEW: ['QUOTED', 'RETURNED', 'CANCELLED'],
  RETURNED: ['DRAFT', 'SUBMITTED', 'CANCELLED'],
  QUOTED: [],
  CANCELLED: [],
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

/**
 * Payments drive PARTIAL / PAID / OVERDUE. Voiding a payment (a bounced cheque, a
 * payment entered twice) walks the invoice back down: PAID → PARTIAL, or all the
 * way to SENT / OVERDUE when it was the last live payment; PARTIAL → SENT likewise.
 */
export const INVOICE_TRANSITIONS = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
  PARTIAL: ['PAID', 'OVERDUE', 'SENT', 'VOID'],
  OVERDUE: ['PARTIAL', 'PAID', 'VOID'],
  PAID: ['PARTIAL', 'SENT', 'OVERDUE', 'VOID'],
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
