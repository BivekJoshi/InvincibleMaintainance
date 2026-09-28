import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Ban, PackageCheck, Truck } from 'lucide-react';
import { FormDialog } from '@/components/common/FormDialog';
import {
  useCancelPurchaseListMutation, useOrderPurchaseListMutation, useReceivePurchaseListMutation,
} from '@/api/stockApi';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { purchaseCancelSchema, purchaseReceiveFormSchema, receivedFieldName } from '@/form/schemas/ops.schema';
import { itemCountText, purchaseListActions, receiveBody } from '@/helpers/purchaseLists';
import { qtyWithUnit } from '@/helpers/execution';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const ICONS = { order: Truck, receive: PackageCheck, cancel: Ban };
const CANCEL_FIELDS = [{ name: 'reason', type: 'textarea', label: 'Why is it cancelled?', rows: 3, maxLength: 500, required: true }];

/** One quantity field per item for the Receive dialog, as ordered to start with. */
function receiveFields(list) {
  return (list?.items ?? []).map((item) => ({
    name: receivedFieldName(item.id),
    type: 'number',
    label: `${item.material?.name ?? 'Material'}${item.material?.code ? ` (${item.material.code})` : ''}`,
    description: `Ordered ${qtyWithUnit(item.qty, item.material?.unit)}${item.packs ? ` — ${item.packs} ${item.material?.packLabel ?? 'packs'}` : ''}. 0 if none came.`,
    min: 0,
    step: 'any',
    required: true,
    span: 'half',
  }));
}

/**
 * A purchase list's moves (Phase L7), the one way a screen runs them — the registry's `useRecordActions` for
 * `purchase-lists`, so the list's row menu and the list's own page offer the same moves:
 *
 *   const [actionsFor, dialogs] = usePurchaseListActions();
 *   actionsFor(list)   // → [{ key, label, icon, primary?, destructive?, disabledReason?, onSelect }]
 *
 * **Mark ordered** asks first; **Receive into stock…** opens the quantities received — as ordered to start with — and
 * sends only what differs (`helpers/purchaseLists#receiveBody`): stock rises by a PURCHASE movement per item with the
 * supplier; **Cancel list…** asks why. A refusal (422 INVALID_TRANSITION — someone moved it first) toasts the API's
 * words. What a state allows is `helpers/purchaseLists#purchaseListActions`, held to the machine.
 */
export function usePurchaseListActions() {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const [receiving, setReceiving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [order] = useOrderPurchaseListMutation();
  const [receive] = useReceivePurchaseListMutation();
  const [cancel] = useCancelPurchaseListMutation();

  const run = useCallback(async (key, list) => {
    if (key === 'receive') { setReceiving(list); return; }
    if (key === 'cancel') { setCancelling(list); return; }
    const ok = await confirm({
      title: `Mark ${list.number} ordered?`,
      description: `${itemCountText(list.items?.length ?? list.itemCount ?? 0)}${list.supplier ? ` from ${list.supplier.name}` : ''}. Once ordered it can be received or cancelled, not edited.`,
      confirmLabel: 'Mark ordered',
    });
    if (!ok) return;
    try {
      await order({ id: list.id, jobId: list.job?.id ?? list.jobId }).unwrap();
      dispatch(toastSuccess(`${list.number} ordered`, 'Receive it into stock when it arrives.'));
    } catch (err) {
      dispatch(toastError(`Could not mark ${list.number} ordered`, err?.data?.error?.message));
    }
  }, [confirm, dispatch, order]);

  const actionsFor = useCallback((list) => purchaseListActions(list, { can }).map((a) => ({
    ...a,
    icon: ICONS[a.key],
    onSelect: () => run(a.key, list),
  })), [can, run]);

  const receiveSchema = useMemo(() => purchaseReceiveFormSchema(receiving?.items ?? []), [receiving]);
  const receiveDefaults = useMemo(
    () => Object.fromEntries((receiving?.items ?? []).map((i) => [receivedFieldName(i.id), i.qty])),
    [receiving],
  );

  const dialogs = (
    <>
      <FormDialog
        open={Boolean(receiving)}
        onOpenChange={(open) => { if (!open) setReceiving(null); }}
        title={receiving ? `Receive ${receiving.number} into stock` : ''}
        description={receiving
          ? `What came${receiving.supplier ? ` from ${receiving.supplier.name}` : ''}, in each material’s unit. Stock rises by a purchase for each — change a quantity when less came.`
          : undefined}
        schema={receiveSchema}
        fields={receiving ? receiveFields(receiving) : []}
        defaultValues={receiveDefaults}
        submitLabel="Receive into stock"
        onSubmit={async (body) => {
          const list = receiving;
          await receive({ id: list.id, jobId: list.job?.id ?? list.jobId, ...receiveBody(body.items, list) }).unwrap();
          dispatch(toastSuccess(`${list.number} received`, 'Stock is up by what came.'));
        }}
      />
      <FormDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title={cancelling ? `Cancel ${cancelling.number}?` : ''}
        description="It stays on record as cancelled. Nothing is added to stock."
        schema={purchaseCancelSchema}
        fields={CANCEL_FIELDS}
        defaultValues={{ reason: '' }}
        submitLabel="Cancel the list"
        onSubmit={async ({ reason }) => {
          const list = cancelling;
          await cancel({ id: list.id, jobId: list.job?.id ?? list.jobId, reason }).unwrap();
          dispatch(toastSuccess(`${list.number} cancelled`));
        }}
      />
      {confirmDialog}
    </>
  );

  return [actionsFor, dialogs];
}
