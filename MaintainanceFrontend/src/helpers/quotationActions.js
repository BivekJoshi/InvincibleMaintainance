/**
 * What can be done to a quotation right now, by whom — the action bar, the list's row
 * menu and their tests all read this one table. The API asserts every move again
 * (`shared/stateMachines.js`, the capabilities, maker-checker); this only decides what
 * the screens offer and why a button is disabled.
 */

/**
 * @typedef {object} QuotationAction
 * @property {'submit'|'approve'|'sendBack'|'pullBack'|'send'|'revise'|'convert'} key
 * @property {string} label
 * @property {boolean} [primary]    the step the quotation is waiting for
 * @property {'required'|'optional'} [note]  asks for a note first
 * @property {string} [disabledReason]      shown instead of running
 */

export const ACTION_LABELS = {
  submit: 'Submit for approval',
  approve: 'Approve',
  sendBack: 'Send back',
  pullBack: 'Pull back',
  send: 'Send to customer',
  revise: 'Revise',
  convert: 'Convert to job',
};

/** Statuses a revision starts from. */
export const REVISABLE = ['SENT', 'CHANGES_REQUESTED', 'REJECTED', 'EXPIRED'];

/**
 * Whether this person prepared the quotation and the maker-checker rule stops them approving it.
 * @param {{ createdById?: string|null, makerChecker?: boolean }} quotation
 * @param {string|undefined} userId
 */
export const isSelfApproval = (quotation, userId) =>
  quotation.makerChecker !== false && Boolean(userId) && quotation.createdById === userId;

/**
 * @param {object} quotation  the API's quotation (list row or detail)
 * @param {{ can: (capability: string) => boolean, userId?: string }} who
 * @returns {QuotationAction[]}
 */
export function quotationActions(quotation, { can, userId }) {
  if (!quotation) return [];
  const write = can('quotations:write');
  const approve = can('quotations:approve');
  const action = (key, extra = {}) => ({ key, label: ACTION_LABELS[key], ...extra });

  switch (quotation.status) {
    case 'DRAFT':
      return write ? [action('submit', { primary: true })] : [];
    case 'PENDING_APPROVAL':
      if (!approve) return [];
      return [
        action('approve', {
          primary: true,
          note: 'optional',
          ...(isSelfApproval(quotation, userId)
            ? { disabledReason: 'You prepared this quotation, so another manager or admin must approve it.' }
            : {}),
        }),
        action('sendBack', { note: 'required' }),
      ];
    case 'OFFICE_APPROVED':
      return write ? [action('send', { primary: true }), action('pullBack', { note: 'required' })] : [];
    case 'SENT':
      return write ? [action('revise')] : [];
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
    case 'EXPIRED':
      return write ? [action('revise', { primary: true })] : [];
    case 'APPROVED':
      // Only a quotation the customer approved before acceptance started creating the job.
      return can('jobs:write') ? [action('convert', { primary: true })] : [];
    default:
      return [];
  }
}

/**
 * The one line under the title that says what the quotation is waiting for.
 * @returns {string|null}
 */
export function waitingFor(quotation, { can, userId }) {
  switch (quotation?.status) {
    case 'DRAFT':
      return 'Draft — edit the lines, then submit it for approval.';
    case 'PENDING_APPROVAL':
      if (can('quotations:approve') && !isSelfApproval(quotation, userId)) return 'Waiting for your approval.';
      return 'Waiting for a manager to approve it.';
    case 'OFFICE_APPROVED':
      return 'Approved — ready to send to the customer.';
    case 'SENT':
      return 'With the customer — waiting for their answer on the link.';
    case 'CHANGES_REQUESTED':
      return 'The customer asked for changes — revise it to send a new version.';
    case 'REJECTED':
      return 'The customer declined. Revise it if they want another offer.';
    case 'EXPIRED':
      return 'Expired before the customer answered. Revise it to send a fresh one.';
    case 'APPROVED':
      return 'Accepted by the customer — convert it to a job.';
    case 'CONVERTED':
      return 'Accepted — the job is in the dispatch queue.';
    case 'SUPERSEDED':
      return 'Replaced by a newer version.';
    default:
      return null;
  }
}
