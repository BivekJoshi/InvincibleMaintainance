import { useEffect, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '../FormField';

const text = (value) => (value == null ? '' : String(value));
const toRows = (object, keys) => (keys
  ? keys.map((key) => ({ key, value: text(object?.[key]) }))
  : Object.entries(object ?? {}).map(([key, value]) => ({ key, value: text(value) })));

/**
 * `{ type: 'keyValue', keyLabel?, valueLabel? }` — a flat JSON object of string
 * values (specifications, per-section settings). Rows are edited locally, so a row
 * with no key yet or a duplicate key is not lost mid-typing; the form value is the
 * object built from rows that have a key, and a later duplicate wins.
 *
 * `keys: ['label', 'url']` (with optional `keyLabels`, `placeholders`) fixes the rows
 * instead: one per key, the key shown as the row's label, nothing to add or remove. The
 * value then always carries every key, empty ones as `''`.
 */
export function KeyValueField({ field, id }) {
  if (field.keys) return <FixedKeysField field={field} id={id} />;
  return <FreeKeysField field={field} id={id} />;
}

function FixedKeysField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const values = input.value ?? {};
  const errorOf = (key) => fieldState.error?.[key]?.message;

  return (
    <FormField id={id} field={field} error={fieldState.error?.message ? fieldState.error : undefined} as="fieldset">
      {() => (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-3">
          {field.keys.map((key, i) => {
            const rowId = `${id}-${key}`;
            return (
              <div key={key} className="contents">
                <label htmlFor={rowId} className="text-sm text-muted-foreground">{field.keyLabels?.[key] ?? key}</label>
                <div className="space-y-1">
                  <Input
                    id={rowId}
                    ref={i === 0 ? input.ref : undefined}
                    value={text(values[key])}
                    disabled={field.disabled}
                    placeholder={field.placeholders?.[key]}
                    aria-invalid={errorOf(key) ? true : undefined}
                    onChange={(e) => input.onChange({ ...Object.fromEntries(field.keys.map((k) => [k, text(values[k])])), [key]: e.target.value })}
                    onBlur={input.onBlur}
                  />
                  {errorOf(key) ? <p className="text-xs font-medium text-destructive">{errorOf(key)}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FormField>
  );
}

function FreeKeysField({ field, id }) {
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
