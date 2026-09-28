import { useCallback } from 'react';
import { useController } from 'react-hook-form';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { formatQty, measurementRowValue, measurementTotal } from '@/helpers/measurements';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';
import { cellMessages } from './cellMessages';

/** A length cell: the number it was read as, or what was typed when it could not be read. */
const lengthCell = (value) => (typeof value === 'number' ? formatQty(value) : value ?? '');

/** The measurement book's columns: where, what, and nos × L × B × H, a deduction, and the row's value. */
const MEASUREMENT_COLUMNS = [
  { key: 'area', header: 'Area / room', grow: 1, minWidth: 120, editor: 'text', maxLength: 80, placeholder: 'Bedroom 1' },
  { key: 'description', header: 'Description', grow: 1.4, minWidth: 150, editor: 'text', maxLength: 200, placeholder: 'North wall' },
  { key: 'nos', header: 'Nos', width: 64, editor: 'length', align: 'right', format: lengthCell },
  { key: 'l', header: 'L', width: 84, editor: 'length', align: 'right', format: lengthCell, placeholder: '12\'6"' },
  { key: 'b', header: 'B', width: 84, editor: 'length', align: 'right', format: lengthCell },
  { key: 'h', header: 'H', width: 84, editor: 'length', align: 'right', format: lengthCell },
  { key: 'deduct', header: 'Deduct', width: 68, editor: 'boolean', align: 'center' },
  {
    key: 'value', header: 'Value', width: 100, align: 'right', get: (row) => measurementRowValue(row),
    format: (v) => (v == null ? '—' : <span className={v < 0 ? 'text-destructive' : undefined}>{formatQty(v)}</span>),
  },
];

let seq = 0;
const blankMeasurement = () => {
  seq += 1;
  return { _key: `m-${seq}`, area: '', description: '', nos: '', l: '', b: '', h: '', deduct: false };
};

/**
 * `{ type: 'measurements', unit?, keptBy? }` — a measurement sheet (Phase L3), the site engineer's measurement book:
 * rows of area, description, nos, L, B, H and a deduct flag. Lengths take feet-inches — `12'6"` is read as
 * 12.5, `6"` as 0.5 — and show as the number they were read as. Each row's value and the sheet's total are a
 * **preview**; the quantity a quotation keeps is the one the server works out from the rows it saves. `keptBy` names
 * what keeps it in the footer — "the job line" for Phase L8's final measurement (default "quotation").
 */
export function MeasurementsField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { readOnly: formReadOnly } = useFormMode();
  const rows = Array.isArray(input.value) ? input.value : [];
  const error = fieldState.error;
  const listError = error?.message ?? error?.root?.message;
  const rowErrors = useCallback((i) => cellMessages(error?.[i]), [error]);
  const total = measurementTotal(rows);
  const onChange = (next) => {
    input.onChange(next);
    input.onBlur();
  };

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <EditableGrid
          ariaLabel={field.label ?? 'Measurement sheet'}
          columns={MEASUREMENT_COLUMNS}
          rows={rows}
          onChange={onChange}
          makeRow={blankMeasurement}
          readOnly={field.disabled || formReadOnly}
          maxRows={200}
          rowErrors={rowErrors}
          focusRef={input.ref}
          maxHeight="24rem"
          emptyText="No measurements. Add a row per wall, floor or opening."
          addLabels={{ item: 'Add measurement' }}
          footer={(
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                Total <span className="font-semibold tabular-nums text-foreground" data-testid="measurement-total">{formatQty(total)}</span>
                {field.unit ? ` ${field.unit}` : ''} — a preview; the {field.keptBy ?? 'quotation'} keeps the server’s figure.
              </p>
              <p>Type feet and inches as 12&apos;6&quot; (read as 12.5). A deduction (a door, a window) subtracts.</p>
            </div>
          )}
        />
      )}
    </FormField>
  );
}
