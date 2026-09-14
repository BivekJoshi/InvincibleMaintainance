import { useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '../FormField';

/** `{ type: 'text', inputType?: 'email'|'url'|'tel', maxLength?, placeholder? }` */
export function TextField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <Input
          {...control}
          ref={input.ref}
          name={input.name}
          type={field.inputType ?? 'text'}
          value={input.value ?? ''}
          onChange={input.onChange}
          onBlur={input.onBlur}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          disabled={field.disabled}
          autoComplete="off"
        />
      )}
    </FormField>
  );
}
