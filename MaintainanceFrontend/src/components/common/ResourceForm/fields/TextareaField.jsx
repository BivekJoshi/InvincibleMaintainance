import { useController } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '../FormField';

/** `{ type: 'textarea', rows?, maxLength?, placeholder? }` */
export function TextareaField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <Textarea
          {...control}
          ref={input.ref}
          name={input.name}
          rows={field.rows ?? 4}
          value={input.value ?? ''}
          onChange={input.onChange}
          onBlur={input.onBlur}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          disabled={field.disabled}
        />
      )}
    </FormField>
  );
}
