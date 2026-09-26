import { useEffect, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '../FormField';

const textOf = (value) => (value == null || Number.isNaN(value) ? '' : String(value));

/**
 * `{ type: 'number', min?, max?, step? }` — a plain count or measure. Never money:
 * money is `type: 'money'`, which knows about rupees and paisa.
 *
 * An emptied field holds `undefined` (sent as null with `nullable: true`). The input keeps
 * what was typed, as the money field does: react-hook-form reports a field's starting value
 * while it is `undefined`, so the input would otherwise put a cleared pack size straight back.
 */
export function NumberField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [text, setText] = useState(() => textOf(input.value));
  const typing = useRef(false);

  // Follow changes made elsewhere — a reset, a record that loaded — unless someone is typing.
  useEffect(() => {
    if (!typing.current) setText(textOf(input.value));
  }, [input.value]);

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <Input
          {...control}
          ref={input.ref}
          name={input.name}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? 'any'}
          value={text}
          onFocus={() => { typing.current = true; }}
          onChange={(e) => {
            setText(e.target.value);
            input.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber);
          }}
          onBlur={() => { typing.current = false; input.onBlur(); }}
          placeholder={field.placeholder}
          disabled={field.disabled}
          className="tabular-nums"
        />
      )}
    </FormField>
  );
}
