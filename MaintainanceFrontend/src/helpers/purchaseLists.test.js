import { describe, expect, it } from 'vitest';
import {
  PURCHASE_LIST_MOVES, purchaseListActions, purchaseListDeletable, purchaseListLock, receiveBody, receiveRows,
} from '@/helpers/purchaseLists';
import { PURCHASE_LIST_STATUSES, PURCHASE_LIST_TRANSITIONS } from '@/config/constants';
import { can as roleCan } from '@/helpers/permissions';
import { purchaseListSchema, purchaseReceiveFormSchema } from '@/form/schemas/ops.schema';
import {
  purchaseListSchema as apiPurchaseListSchema, purchaseReceiveSchema as apiReceiveSchema,
} from '../../../MaintainanceBackend/src/shared/schemas/ops.js';

const who = (role) => ({ can: (c) => roleCan(role, c) });
const list = (status, items = [{ id: 'i1', qty: 75 }]) => ({ id: 'pl1', status, items });

describe('a purchase list’s moves (Phase L7)', () => {
  it('offers exactly the moves the machine allows from each state — and nothing from a final one', () => {
    for (const status of PURCHASE_LIST_STATUSES) {
      const offered = purchaseListActions(list(status), who('DISPATCHER')).map((a) => PURCHASE_LIST_MOVES[a.key]);
      expect(offered.sort(), status).toEqual([...PURCHASE_LIST_TRANSITIONS[status]].sort());
    }
    expect(purchaseListActions(list('RECEIVED'), who('DISPATCHER'))).toEqual([]);
    expect(purchaseListActions(list('CANCELLED'), who('ADMIN'))).toEqual([]);
  });

  it('offers none to a role that cannot write materials, and will not order an empty list', () => {
    for (const role of ['SALES', 'MANAGER', 'ACCOUNTANT', 'TECHNICIAN']) expect(purchaseListActions(list('DRAFT'), who(role)), role).toEqual([]);
    const [order] = purchaseListActions(list('DRAFT', []), who('DISPATCHER'));
    expect(order).toMatchObject({ key: 'order', disabledReason: 'Add at least one material before ordering.' });
  });

  it('locks every state but a draft, and deletes only a draft', () => {
    expect(purchaseListLock(list('DRAFT'))).toBeNull();
    for (const status of ['ORDERED', 'RECEIVED', 'CANCELLED']) {
      expect(purchaseListLock(list(status)), status).toBeTruthy();
      expect(purchaseListDeletable(list(status))).toBe(false);
    }
    expect(purchaseListDeletable(list('DRAFT'))).toBe(true);
  });

  it('receives as ordered with an empty body, and otherwise names each item — a body the API takes', () => {
    const ordered = { items: [{ id: 'i1', qty: 75, material: { name: 'Cement' } }, { id: 'i2', qty: 4 }] };
    expect(receiveRows(ordered).map((r) => r.receivedQty)).toEqual([75, 4]);
    const asOrdered = purchaseReceiveFormSchema(ordered.items).parse({ received_i1: 75, received_i2: '4' });
    expect(receiveBody(asOrdered.items, ordered)).toEqual({});
    const short = purchaseReceiveFormSchema(ordered.items).parse({ received_i1: '50', received_i2: 0 });
    const body = receiveBody(short.items, ordered);
    expect(body).toEqual({ items: [{ itemId: 'i1', receivedQty: 50 }, { itemId: 'i2', receivedQty: 0 }] });
    expect(apiReceiveSchema.safeParse(body).success).toBe(true);
    expect(purchaseReceiveFormSchema(ordered.items).safeParse({ received_i1: '-1', received_i2: 4 }).success).toBe(false);
  });

  it('sends a list the API’s own schema takes: blank rows dropped, packs whole, no item ids', () => {
    const body = purchaseListSchema.parse({
      jobId: 'j9', supplierId: null, note: 'Shortfall',
      items: [
        { id: 'i1', materialId: 'm1', material: { name: 'Cement' }, qty: '1,200', packs: '24', note: '', receivedQty: null },
        { materialId: null, material: null, qty: '', packs: '', note: '' },
      ],
    });
    expect(body.items).toEqual([{ materialId: 'm1', qty: 1200, packs: 24 }]);
    expect(apiPurchaseListSchema.safeParse(body).success).toBe(true);
    const refused = purchaseListSchema.safeParse({ items: [{ materialId: 'm1', qty: '2', packs: '1.5' }] });
    expect(refused.success).toBe(false);
    expect(purchaseListSchema.safeParse({ items: [] }).error.issues[0].message).toBe('Add at least one material');
  });
});
