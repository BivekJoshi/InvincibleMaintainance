import { useCallback } from 'react';
import { useController } from 'react-hook-form';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { Button } from '@/components/ui/button';
import { PAYMENT_SCHEDULE_PRESETS, PAYMENT_TRIGGERS, PAYMENT_TRIGGER_LABELS } from '@/config/constants';
import { formatNpr } from '@/helpers/format';
import { formatQty } from '@/helpers/measurements';
import {
  blankStage, formatShare, matchingPreset, presetRows, scheduleTotal,
} from '@/helpers/paymentSchedule';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';
import { cellMessages } from './cellMessages';

const TRIGGER_OPTIONS = PAYMENT_TRIGGERS.map((value) => ({ value, label: PAYMENT_TRIGGER_LABELS[value] }));

/** A share as the grid shows it: `50` → `50%`; what was typed when it cannot be read. */
const pctCell = (v) => (typeof v === 'number' ? `${formatQty(v)}%` : v ?? '');

/**
 * The schedule's columns: the stage's words, its share, when it falls due, and the server's amount for it — the
 * amount column has no editor and shows only what `figures` (the preview's or the saved stages) gives.
 */
const COLUMNS = [
  { key: 'label', header: 'Stage', grow: 1.4, minWidth: 140, editor: 'text', maxLength: 80, placeholder: 'Advance' },
  { key: 'pct', header: 'Share', width: 84, editor: 'number', align: 'right', format: pctCell, placeholder: '50' },
  {
    key: 'trigger', header: 'Falls due', width: 200, editor: 'select', options: TRIGGER_OPTIONS,
    format: (v) => PAYMENT_TRIGGER_LABELS[v] ?? v ?? '',
  },
  {
    key: 'amount', header: 'Amount', width: 150, align: 'right', get: () => null,
    format: (_v, _row, { meta }) => (meta?.total != null
      ? (
        <span className="tabular-nums" title={meta.vat ? `VAT ${formatNpr(meta.vat)}` : undefined}>
          {formatNpr(meta.total)}
        </span>
      )
      : <span className="text-muted-foreground">—</span>),
  },
];

/** "Adds up to 100 %" — or how far off it is, in words. */
function TotalLine({ rows }) {
  const { totalBp, readable } = scheduleTotal(rows);
  const any = rows.some((r) => r && (String(r.label ?? '').trim() || String(r.pct ?? '').trim()));
  if (!any) return <p className="text-xs text-muted-foreground">No stages — pick a preset or add one.</p>;
  const ok = readable && totalBp === 10000;
  const gap = 10000 - totalBp;
  return (
    <p className={cn('flex items-center gap-1.5 text-xs font-medium', ok ? 'text-success' : 'text-destructive')} data-testid="schedule-total">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
      {!readable
        ? 'A share cannot be read — use a number such as 40 or 12.5.'
        : ok
          ? 'Adds up to 100%.'
          : `Adds up to ${formatShare(totalBp)} — ${formatShare(Math.abs(gap))} ${gap > 0 ? 'short' : 'over'}. The stages must make 100%.`}
    </p>
  );
}

/**
 * `{ type: 'paymentSchedule', figures?, stale?, maxItems? }` — a quotation's payment schedule (L-D3, Phase L4) on
 * the kit's EditableGrid: one row per stage — its words, its **share in %**, and when it falls due (on acceptance,
 * at a milestone, on completion) — with the presets 50 · 40 · 10, 40 · 30 · 20 · 10 and 100 on completion one click
 * away. The value is the rows (`helpers/paymentSchedule#toStageRows` on load); the schema (`paymentScheduleSchema`)
 * sends `{ label, basisPoints, trigger }` and refuses a schedule that does not make exactly 100 % or has two
 * advances, as the API does.
 *
 * **The amounts are the server's**: `figures` is the list of stages the preview (or the saved quotation) answered,
 * matched by position, each with its `total` and `vat`; `stale` dims them while a newer answer is on its way. The
 * field multiplies nothing.
 */
export function PaymentScheduleField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { readOnly: formReadOnly } = useFormMode();
  const readOnly = field.disabled || formReadOnly;
  const rows = Array.isArray(input.value) ? input.value : [];
  const error = fieldState.error;
  const listError = error?.message ?? error?.root?.message;
  const rowErrors = useCallback((i) => cellMessages(error?.[i]), [error]);
  const figures = field.figures;
  const rowMeta = useCallback((_row, i) => figures?.[i], [figures]);
  const pressed = matchingPreset(rows);
  const onChange = (next) => {
    input.onChange(next);
    input.onBlur();
  };

  const presets = readOnly ? null : (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Presets">
      <span className="text-xs text-muted-foreground">Presets:</span>
      {PAYMENT_SCHEDULE_PRESETS.map((p) => (
        <Button
          key={p.key}
          type="button"
          size="sm"
          variant={pressed === p.key ? 'default' : 'outline'}
          aria-pressed={pressed === p.key}
          onClick={() => onChange(presetRows(p.key))}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <div className={cn('space-y-2 transition-opacity', field.stale && 'opacity-80')} aria-busy={field.stale || undefined}>
          <EditableGrid
            ariaLabel={field.label ?? 'Payment schedule'}
            columns={COLUMNS}
            rows={rows}
            onChange={onChange}
            makeRow={blankStage}
            readOnly={readOnly}
            maxRows={field.maxItems ?? 10}
            rowErrors={rowErrors}
            rowMeta={rowMeta}
            focusRef={input.ref}
            maxHeight="20rem"
            emptyText="No stages yet. Pick a preset, or add a stage."
            addLabels={{ item: 'Add stage' }}
            toolbarExtra={presets}
            footer={(
              <div className="space-y-0.5">
                <TotalLine rows={rows} />
                <p className="text-xs text-muted-foreground">
                  Amounts are worked out by the server from the total — VAT shared the same way, the last stage taking any paisa left over.
                </p>
              </div>
            )}
          />
        </div>
      )}
    </FormField>
  );
}
