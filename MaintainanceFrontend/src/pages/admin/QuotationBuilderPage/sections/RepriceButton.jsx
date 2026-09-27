import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCcw } from 'lucide-react';
import { useRepriceQuotationMutation } from '@/api/quotationsApi';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** What a reprice would change — the server's before and after, shown inside the confirmation. */
function RepricePreviewTable({ rows, showCost }) {
  return (
    <div className="space-y-2 text-sm">
      <p>Today’s library rates and recipes for these rows. Rows typed by hand keep their rate.</p>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Rows before and after the reprice</caption>
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">Row</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Rate now</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">From the library</th>
              {showCost ? <th scope="col" className="px-2 py-1.5 text-right font-medium">Unit cost</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <th scope="row" className="px-2 py-1.5 font-normal text-foreground">
                  <span className="font-mono font-semibold">{r.number}</span> <span className="text-muted-foreground">{r.description}</span>
                </th>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatNpr(r.rate)}</td>
                <td className={cn('whitespace-nowrap px-2 py-1.5 text-right tabular-nums', r.newRate !== r.rate && 'font-semibold text-foreground')}>{formatNpr(r.newRate)}</td>
                {showCost ? (
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {r.unitCost == null ? '—' : formatNpr(r.unitCost)} → {r.newUnitCost == null ? '—' : formatNpr(r.newUnitCost)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * "Reprice from the library" on a DRAFT (`quotations:write`): the rows priced from the rate library take
 * today's rates and recipes — a library change never reaches a draft otherwise (L-D1). Preview
 * (`apply: false`, nothing written) → the before/after in a confirmation → apply. Held while the form has edits,
 * because it acts on the saved rows.
 */
export function RepriceButton({ quotation, disabledReason }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [reprice] = useRepriceQuotationMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const preview = await reprice({ id: quotation.id, apply: false }).unwrap();
      const rows = (preview?.rows ?? []).filter((r) => r.newRate !== r.rate || r.newUnitCost !== r.unitCost);
      if (!rows.length) {
        dispatch(toastSuccess('Nothing to reprice', 'Every row priced from the library already has today’s rate and recipe.'));
        return;
      }
      const ok = await confirm({
        title: `Reprice ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} from the library?`,
        description: <RepricePreviewTable rows={rows} showCost={can('costs:read')} />,
        confirmLabel: 'Reprice',
      });
      if (!ok) return;
      const done = await reprice({ id: quotation.id, apply: true }).unwrap();
      const applied = done?.applied ?? rows.length;
      dispatch(toastSuccess(`${applied} ${applied === 1 ? 'row' : 'rows'} repriced`, 'The totals have been worked out again.'));
    } catch (err) {
      dispatch(toastError('Could not reprice', err?.data?.error?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy || Boolean(disabledReason)} title={disabledReason}>
        <RefreshCcw aria-hidden /> Reprice from the library
      </Button>
      {confirmDialog}
    </>
  );
}
