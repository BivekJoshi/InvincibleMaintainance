import { useEffect, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { formatRupees, parseRupees } from '@/helpers/format';
import { FormField } from '../FormField';

/**
 * `{ type: 'money' }` — an amount in **rupees**.
 *
 * The form value is rupees (a number), because requests send rupees; the record's
 * paisa were converted on the way in by `toFormValues`. What is typed may carry
 * digit grouping (`1,23,45,678.90`) or a `Rs.` prefix; it is read with `parseRupees`
 * and shown grouped again once the field loses focus. Unreadable input becomes NaN
 * so the schema reports it rather than it silently turning into 0.
 */
export function MoneyField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [text, setText] = useState(() => formatRupees(input.value));
  const typing = useRef(false);

  // Follow changes made elsewhere — a reset, a record that loaded — unless someone is typing.
  useEffect(() => {
    if (!typing.current) setText(Number.isFinite(input.value) ? formatRupees(input.value) : '');
  }, [input.value]);

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
            Rs.
          </span>
          <Input
            {...control}
            ref={input.ref}
            name={input.name}
            inputMode="decimal"
            autoComplete="off"
            className="pl-10 tabular-nums"
            value={text}
            placeholder={field.placeholder ?? '0.00'}
            disabled={field.disabled}
            onFocus={() => { typing.current = true; }}
            onChange={(e) => {
              setText(e.target.value);
              const rupees = parseRupees(e.target.value);
              input.onChange(rupees ?? (e.target.value.trim() === '' ? undefined : Number.NaN));
            }}
            onBlur={() => {
              typing.current = false;
              const rupees = parseRupees(text);
              if (rupees != null) setText(formatRupees(rupees));
              input.onBlur();
            }}
          />
        </div>
      )}
    </FormField>
  );
}
