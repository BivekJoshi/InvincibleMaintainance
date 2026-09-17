import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FormDialog } from '@/components/common/FormDialog';
import {
  useApproveQuotationMutation, useConvertQuotationToJobMutation, usePullBackQuotationMutation,
  useReviseQuotationMutation, useSendBackQuotationMutation, useSendQuotationMutation, useSubmitQuotationMutation,
} from '@/api/quotationsApi';
import { useConfirm } from '@/hooks/useConfirm';
import { quotationNoteSchema } from '@/form/schemas/quotation.schema';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatNpr } from '@/helpers/format';

/** The note dialog's words per action. */
const NOTE_COPY = {
  approve: {
    title: 'Approve this quotation',
    description: 'It can then be sent to the customer. A remark is optional.',
    label: 'Remark (optional)',
    submitLabel: 'Approve',
  },
  sendBack: {
    title: 'Send back to the draft',
    description: 'Whoever prepared it sees this note on the quotation and can edit and resubmit it.',
    label: 'What needs to change',
    submitLabel: 'Send back',
  },
  pullBack: {
    title: 'Pull back before sending',
    description: 'It returns to the draft and the approval is cleared. It needs approval again before sending.',
    label: 'Why it is being pulled back',
    submitLabel: 'Pull back',
  },
};

/**
 * Runs a quotation action from `helpers/quotationActions` — the one way a screen moves
 * a quotation. Actions with a note ask for it first; sending, revising and converting
 * ask for a confirmation. A refusal toasts the API's reason.
 *
 *   const [runAction, actionDialogs] = useQuotationActions();
 *   await runAction(action, quotation);   // true when it ran
 *
 * @returns {[(action: { key: string, note?: string }, quotation: object) => Promise<boolean>, import('react').ReactElement]}
 */
export function useQuotationActions() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [asking, setAsking] = useState(null); // { action, quotation, resolve }

  const [submit] = useSubmitQuotationMutation();
  const [approve] = useApproveQuotationMutation();
  const [sendBack] = useSendBackQuotationMutation();
  const [pullBack] = usePullBackQuotationMutation();
  const [send] = useSendQuotationMutation();
  const [revise] = useReviseQuotationMutation();
  const [convert] = useConvertQuotationToJobMutation();

  const fail = useCallback((what, err) => {
    dispatch(toastError(what, err?.data?.error?.message ?? 'Please try again.'));
  }, [dispatch]);

  const run = useCallback(async (action, q) => {
    const name = `${q.number}${q.version > 1 ? ` v${q.version}` : ''}`;
    if (action.disabledReason) return false;

    if (action.note) {
      return new Promise((resolve) => setAsking({ action, quotation: q, resolve }));
    }

    try {
      switch (action.key) {
        case 'submit': {
          const result = await submit({ id: q.id }).unwrap();
          dispatch(result.autoApproved
            ? toastSuccess(`${name} approved automatically`, 'Its total is below the auto-approval limit. It is ready to send.')
            : toastSuccess(`${name} submitted`, 'The managers have been told it is waiting for approval.'));
          return true;
        }
        case 'send': {
          const ok = await confirm({
            title: `Send ${name} to ${q.customer?.name ?? 'the customer'}?`,
            description: `They get an SMS${q.customer?.email ? ' and an email' : ''} with a link to accept, ask for changes or decline ${formatNpr(q.total)}.`,
            confirmLabel: 'Send',
          });
          if (!ok) return false;
          await send({ id: q.id }).unwrap();
          dispatch(toastSuccess(`${name} sent to ${q.customer?.name ?? 'the customer'}`));
          return true;
        }
        case 'revise': {
          const ok = await confirm({
            title: `Revise ${name}?`,
            description: q.status === 'SENT'
              ? 'A new draft version is made from it, and the link the customer has stops taking answers. The new version needs approval before it is sent.'
              : 'A new draft version is made from it. It needs approval again before it is sent.',
            confirmLabel: 'Create revision',
          });
          if (!ok) return false;
          const copy = await revise({ id: q.id }).unwrap();
          dispatch(toastSuccess(`Version ${copy.version} created`, `${copy.number} is a draft — edit it, then submit it.`));
          navigate(`/admin/quotations/${copy.id}`);
          return true;
        }
        case 'convert': {
          const ok = await confirm({
            title: `Create the job for ${name}?`,
            description: 'An unscheduled job is created from it and waits in the dispatch queue.',
            confirmLabel: 'Create job',
          });
          if (!ok) return false;
          const job = await convert({ id: q.id }).unwrap();
          dispatch(toastSuccess(`Job ${job.number} created`, 'It is waiting to be scheduled.'));
          return true;
        }
        default:
          return false;
      }
    } catch (err) {
      fail(`Could not ${action.label?.toLowerCase() ?? 'do that'}`, err);
      return false;
    }
  }, [confirm, convert, dispatch, fail, navigate, revise, send, submit]);

  const close = (open) => {
    if (open) return;
    asking?.resolve(false);
    setAsking(null);
  };

  const copy = asking ? NOTE_COPY[asking.action.key] : null;
  const dialog = (
    <FormDialog
      open={Boolean(asking)}
      onOpenChange={close}
      title={copy?.title}
      description={copy?.description}
      schema={quotationNoteSchema(asking?.action.note === 'required')}
      fields={[{ name: 'note', type: 'textarea', label: copy?.label, rows: 3, maxLength: 1000, required: asking?.action.note === 'required' }]}
      defaultValues={{ note: '' }}
      submitLabel={copy?.submitLabel}
      onSubmit={async ({ note }) => {
        const { action, quotation: q, resolve } = asking;
        const mutate = { approve, sendBack, pullBack }[action.key];
        // A refusal throws: the dialog stays open with the API's message.
        await mutate({ id: q.id, ...(note ? { note } : {}) }).unwrap();
        const verb = { approve: 'approved', sendBack: 'sent back', pullBack: 'pulled back' }[action.key];
        dispatch(toastSuccess(`${q.number} ${verb}`));
        resolve(true);
        setAsking(null);
      }}
    />
  );

  return [run, <>{dialog}{confirmDialog}</>];
}
