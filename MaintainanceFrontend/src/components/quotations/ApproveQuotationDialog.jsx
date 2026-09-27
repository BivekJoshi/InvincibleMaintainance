import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApproveQuotationMutation } from '@/api/quotationsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { useAuth } from '@/hooks/useAuth';
import { approveQuotationSchema } from '@/form/schemas/quotation.schema';
import { formatNpr } from '@/helpers/format';
import { marginOf } from '@/helpers/quotationActions';
import { cn } from '@/helpers/utils';

/** The margin the approver is signing off, as the server worked it out — a `preview` field inside the dialog. */
function MarginPanel({ field }) {
  const { margin, lowMargin } = field;
  const known = Boolean(margin.margin && margin.margin.pct != null && margin.costComplete !== false && lowMargin?.costComplete !== false);
  const min = lowMargin?.minMarginPct;
  return (
    <div
      className={cn('space-y-1 rounded-lg border p-3 text-sm', (lowMargin || !known) && 'surface-warning')}
      data-testid="approve-margin"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">Margin</span>
        <span className={cn('font-semibold tabular-nums', known && margin.margin.amount < 0 && 'text-destructive')}>
          {known ? `${formatNpr(margin.margin.amount)} · ${margin.margin.pct}%` : 'Unknown'}
        </span>
      </div>
      {margin.costTotal != null ? (
        <p className="text-xs opacity-80">Cost of the rows {formatNpr(margin.costTotal)} — on the amount before VAT, after the discount.</p>
      ) : null}
      {!known ? (
        <p className="flex gap-1.5 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Some rows have no known cost, so the margin cannot be worked out.</p>
      ) : null}
      {lowMargin && known && min != null ? (
        <p className="flex gap-1.5 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Below the {min}% minimum.</p>
      ) : null}
    </div>
  );
}

/**
 * Approve a quotation (Phase L4): the approver sees the **margin** (they hold `costs:read`; the server's figure, never
 * worked out here) and adds an optional remark. When the margin is below `quotation.minMarginPct` or a row's cost is
 * unknown, the API refuses with 422 `LOW_MARGIN`; the dialog then asks for an explicit acknowledgement — a checkbox
 * — and sends again with `acknowledgeLowMargin: true`. An unknown cost is predicted from the record, so the checkbox
 * is there from the start; a known margin below the minimum is learnt from the API's answer (the minimum is a
 * setting the approver may not read).
 *
 * @param {{ quotation: object|null, open: boolean, onOpenChange: (open: boolean) => void,
 *   onApproved: (quotation: object) => void }} props
 */
export function ApproveQuotationDialog({ quotation: q, open, onOpenChange, onApproved }) {
  const { can } = useAuth();
  const [approve] = useApproveQuotationMutation();
  const [lowMargin, setLowMargin] = useState(null); // the API's LOW_MARGIN details, once it has said so
  const seesCost = can('costs:read');
  const margin = marginOf(q);
  const predicted = seesCost && margin.known === false;
  const needsAck = Boolean(lowMargin) || predicted;
  const schema = useMemo(() => approveQuotationSchema(needsAck), [needsAck]);

  const fields = [
    // The margin as the server sent it — to costs:read only, and only when it sent one (null: no cost at all).
    ...(seesCost && (margin.known !== null || lowMargin)
      ? [{ name: 'marginPanel', type: 'preview', label: 'Margin', component: MarginPanel, margin, lowMargin }]
      : []),
    { name: 'note', type: 'textarea', label: 'Remark (optional)', rows: 3, maxLength: 1000 },
    ...(needsAck ? [{
      name: 'acknowledgeLowMargin',
      type: 'checkbox',
      tone: 'warning',
      required: true,
      label: lowMargin?.costComplete === false || (!lowMargin && predicted)
        ? 'I approve it although the margin is unknown'
        : `I approve it below the ${lowMargin?.minMarginPct ?? 'minimum'}% minimum margin`,
      description: 'Your acknowledgement is recorded with the approval.',
    }] : []),
  ];

  const close = (next) => {
    if (!next) setLowMargin(null);
    onOpenChange(next);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Approve this quotation"
      description="It can then be sent to the customer. A remark is optional."
      schema={schema}
      fields={fields}
      defaultValues={{ note: '', acknowledgeLowMargin: false }}
      submitLabel="Approve"
      onSubmit={async ({ note, acknowledgeLowMargin }) => {
        try {
          const result = await approve({
            id: q.id,
            ...(note ? { note } : {}),
            ...(needsAck && acknowledgeLowMargin ? { acknowledgeLowMargin: true } : {}),
          }).unwrap();
          setLowMargin(null);
          onApproved(result);
          return result;
        } catch (err) {
          // The dialog stays open with the API's words; LOW_MARGIN also brings up the acknowledgement.
          if (err?.data?.error?.code === 'LOW_MARGIN') setLowMargin(err.data.error.details ?? {});
          throw err;
        }
      }}
    />
  );
}
