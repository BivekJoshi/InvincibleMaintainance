import { useController } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { titleCase } from '@/helpers/format';
import { FormField } from '../FormField';

/** Radix Select cannot hold an empty value, so "none" needs a sentinel. */
const NONE = '__none';

/** Options may be plain enum values (`'NEW'`, labelled `New`) or `{ value, label }`. */
const normalise = (options = []) => options.map((o) => (typeof o === 'object' ? o : { value: o, label: titleCase(String(o)) }));

/**
 * `{ type: 'select' | 'enum', options, noneLabel? }` — one value from a fixed list.
 * An optional field gets a "None" choice that clears it.
 */
export function SelectField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const options = normalise(field.options);
  const empty = input.value == null || input.value === '';

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <Select
          value={empty ? (field.required ? '' : NONE) : String(input.value)}
          onValueChange={(v) => input.onChange(v === NONE ? undefined : v)}
          disabled={field.disabled}
          name={input.name}
        >
          <SelectTrigger {...control} ref={input.ref} onBlur={input.onBlur}>
            <SelectValue placeholder={field.placeholder ?? 'Choose…'} />
          </SelectTrigger>
          <SelectContent>
            {field.required ? null : <SelectItem value={NONE}>{field.noneLabel ?? 'None'}</SelectItem>}
            {options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
