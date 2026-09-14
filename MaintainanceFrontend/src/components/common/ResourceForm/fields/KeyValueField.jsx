import { useEffect, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '../FormField';

const toRows = (object) => Object.entries(object ?? {}).map(([key, value]) => ({ key, value: value == null ? '' : String(value) }));

/**
 * `{ type: 'keyValue', keyLabel?, valueLabel? }` — a flat JSON object of string
 * values (specifications, per-section settings). Rows are edited locally, so a row
 * with no key yet or a duplicate key is not lost mid-typing; the form value is the
 * object built from rows that have a key, and a later duplicate wins.
 */
export function KeyValueField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [rows, setRows] = useState(() => toRows(input.value));
  const emitted = useRef(input.value);

  // A reset or a loaded record replaces the rows; our own edits do not round-trip.
  useEffect(() => {
    if (input.value !== emitted.current) {
      emitted.current = input.value;
      setRows(toRows(input.value));
    }
  }, [input.value]);

  const emit = (next) => {
    setRows(next);
    const object = Object.fromEntries(next.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
    emitted.current = object;
    input.onChange(object);
  };

  const counts = rows.reduce((acc, r) => {
    const k = r.key.trim();
    if (k) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {() => (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Input
                  ref={i === 0 ? input.ref : undefined}
                  value={row.key}
                  disabled={field.disabled}
                  placeholder={field.keyLabel ?? 'Name'}
                  aria-label={`${field.keyLabel ?? 'Name'} ${i + 1}`}
                  aria-invalid={counts[row.key.trim()] > 1 ? true : undefined}
                  className="w-2/5"
                  onChange={(e) => emit(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                  onBlur={input.onBlur}
                />
                <Input
                  value={row.value}
                  disabled={field.disabled}
                  placeholder={field.valueLabel ?? 'Value'}
                  aria-label={`${field.valueLabel ?? 'Value'} ${i + 1}`}
                  onChange={(e) => emit(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                  onBlur={input.onBlur}
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => emit(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`}>
                  <X aria-hidden />
                </Button>
              </div>
              {counts[row.key.trim()] > 1 ? (
                <p className="text-xs text-destructive">“{row.key.trim()}” is used more than once — only the last one is kept.</p>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={field.disabled} onClick={() => setRows([...rows, { key: '', value: '' }])}>
            <Plus aria-hidden /> {field.addLabel ?? 'Add row'}
          </Button>
        </div>
      )}
    </FormField>
  );
}
