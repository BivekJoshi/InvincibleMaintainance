import { useController } from 'react-hook-form';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { FormField } from '../FormField';

/**
 * `{ type: 'relation', relation: { path, labelKey?, valueKey?, params? } }` — an id
 * picked from an admin list endpoint, searched by `?q=` as you type. Clearing it
 * sends null, which is how the API unlinks a relation.
 */
export function RelationField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <RecordCombobox
          {...field.relation}
          {...control}
          value={input.value ?? null}
          onChange={(value) => { input.onChange(value ?? null); input.onBlur(); }}
          placeholder={field.placeholder ?? `Choose ${field.label?.toLowerCase() ?? 'a record'}…`}
          clearable={!field.required}
          disabled={field.disabled}
        />
      )}
    </FormField>
  );
}
