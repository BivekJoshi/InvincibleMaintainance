import { PURCHASE_LIST_TRANSITIONS } from '@/config/constants';

/**
 * A purchase list's moves (Phase L7) without a DOM: what its state allows, by whom, and why a move is off. The list
 * page's row menu and the list's own page read this one table; a unit test holds it to `PURCHASE_LIST_TRANSITIONS`
 * (the API's machine, mirrored in `config/constants.js`). The API asserts every move again.
 *
 * DRAFT → Order (ordered from the supplier) · Cancel; ORDERED → Receive (a PURCHASE stock movement per item, with the
 * supplier and the list's number) · Cancel; RECEIVED and CANCELLED are final.
 */

/** Each move and the state it leads to. */
export const PURCHASE_LIST_MOVES = {
  order: 'ORDERED',
  receive: 'RECEIVED',
  cancel: 'CANCELLED',
};

export const PURCHASE_LIST_ACTION_LABELS = {
  order: 'Mark ordered',
  receive: 'Receive into stock…',
  cancel: 'Cancel list…',
};

/** A state's tone on the semantic surfaces (`StateBadge`). */
export const PURCHASE_LIST_TONES = { DRAFT: 'muted', ORDERED: 'info', RECEIVED: 'success', CANCELLED: 'muted' };

/**
 * @param {{ status: string, items?: object[], itemCount?: number }} list
 * @param {{ can: (capability: string) => boolean }} who
 * @returns {{ key: 'order'|'receive'|'cancel', label: string, primary?: boolean, destructive?: boolean, disabledReason?: string }[]}
 */
export function purchaseListActions(list, { can }) {
  if (!list || !can('materials:write')) return [];
  const allowed = PURCHASE_LIST_TRANSITIONS[list.status] ?? [];
  const count = list.items?.length ?? list.itemCount ?? 0;
  const out = [];
  for (const [key, to] of Object.entries(PURCHASE_LIST_MOVES)) {
    if (!allowed.includes(to)) continue;
    const action = { key, label: PURCHASE_LIST_ACTION_LABELS[key] };
    if (key === 'cancel') action.destructive = true;
    else action.primary = true;
    if (key === 'order' && !count) action.disabledReason = 'Add at least one material before ordering.';
    out.push(action);
  }
  return out;
}

/** Why a list's form is read only — only a draft is edited (the API answers 422 otherwise). Null for a draft. */
export function purchaseListLock(list) {
  if (!list || list.status === 'DRAFT') return null;
  if (list.status === 'ORDERED') return 'Ordered — it can be received or cancelled, not edited.';
  if (list.status === 'RECEIVED') return 'Received into stock — it is on record and cannot change.';
  return 'Cancelled — it is on record and cannot change.';
}

/** Only a draft is deleted; an ordered list is cancelled instead (the API's rule). */
export const purchaseListDeletable = (list) => list?.status === 'DRAFT';

/**
 * The Receive dialog's rows: each item with what was ordered, and received as ordered to start with. Quantities in
 * the material's own unit.
 * @param {{ items?: object[] }} list
 */
export function receiveRows(list) {
  return (list?.items ?? []).map((item) => ({
    itemId: item.id,
    material: item.material ?? null,
    qty: item.qty,
    packs: item.packs ?? null,
    receivedQty: item.receivedQty ?? item.qty,
  }));
}

/**
 * The Receive body: nothing when everything came as ordered (the API's default), else each item's quantity.
 * @param {{ itemId: string, receivedQty: number }[]} items  the validated rows
 * @param {{ items?: object[] }} list
 */
export function receiveBody(items, list) {
  const ordered = new Map((list?.items ?? []).map((i) => [i.id, Number(i.qty)]));
  const asOrdered = items.every((i) => ordered.get(i.itemId) === Number(i.receivedQty));
  return asOrdered ? {} : { items };
}

/** "3 items" — the list's size in words. */
export const itemCountText = (n) => `${n} item${n === 1 ? '' : 's'}`;
