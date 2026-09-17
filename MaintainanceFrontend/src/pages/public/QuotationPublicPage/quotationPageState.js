/**
 * What the customer's page shows below the document, from the quotation the API returned
 * (`GET /public/quotations/:token` or a decide's answer):
 *
 * - `open`      — SENT: the three answers (`actions` from the API)
 * - `accepted`  — APPROVED / CONVERTED
 * - `changes`   — CHANGES_REQUESTED, with their message
 * - `declined`  — REJECTED
 * - `expired`   — EXPIRED: a call button
 * - `replaced`  — SUPERSEDED with a newer version out: a link to it
 * - `replacedPending` — SUPERSEDED, the newer version not sent yet
 * - `closed`    — anything else
 *
 * @param {{ status: string, actions?: string[], replaced?: { token: string }|null }} quotation
 * @returns {{ kind: string, actions: string[], replacedToken?: string }}
 */
export function quotationPageState(quotation) {
  const actions = quotation?.actions ?? [];
  switch (quotation?.status) {
    case 'SENT':
      return actions.length ? { kind: 'open', actions } : { kind: 'closed', actions: [] };
    case 'APPROVED':
    case 'CONVERTED':
      return { kind: 'accepted', actions: [] };
    case 'CHANGES_REQUESTED':
      return { kind: 'changes', actions: [] };
    case 'REJECTED':
      return { kind: 'declined', actions: [] };
    case 'EXPIRED':
      return { kind: 'expired', actions: [] };
    case 'SUPERSEDED':
      return quotation.replaced?.token
        ? { kind: 'replaced', actions: [], replacedToken: quotation.replaced.token }
        : { kind: 'replacedPending', actions: [] };
    default:
      return { kind: 'closed', actions: [] };
  }
}
