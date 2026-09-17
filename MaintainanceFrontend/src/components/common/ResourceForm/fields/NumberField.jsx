import { useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '../FormField';

/**
 * `{ type: 'number', min?, max?, step? }` — a plain count or measure. Never money:
 * money is `type: 'money'`, which knows about rupees and paisa.
 */
export function NumberField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });

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
          value={input.value ?? ''}
          onChange={(e) => input.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
          onBlur={input.onBlur}
          placeholder={field.placeholder}
          disabled={field.disabled}
          className="tabular-nums"
        />
      )}
    </FormField>
  );
}
