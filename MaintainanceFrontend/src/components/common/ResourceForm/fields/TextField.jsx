import { useController } from 'react-hook-form';
import { useGetSuggestionsQuery } from '@/api/lookupApi';
import { Input } from '@/components/ui/input';
import { FormField } from '../FormField';

/** The words an endpoint suggests (`string[]`), as a datalist's options. */
function RemoteSuggestions({ listId, from, extra = [] }) {
  const { data = [] } = useGetSuggestionsQuery(from);
  const words = [...new Set([...extra, ...data])];
  return (
    <datalist id={listId}>
      {words.map((w) => <option key={w} value={w} />)}
    </datalist>
  );
}

/**
 * `{ type: 'text', inputType?: 'email'|'url'|'tel', maxLength?, placeholder?, suggestions?, suggestionsFrom? }`
 *
 * `suggestions` (`string[]`) and `suggestionsFrom` (`{ path, tag? }` — an endpoint answering `string[]`, such as
 * the expense categories in use, Phase I) offer words to pick from in a datalist; anything else may still be typed.
 */
export function TextField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const listId = field.suggestions?.length || field.suggestionsFrom ? `${id}-suggestions` : undefined;

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <>
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
            list={listId}
          />
          {field.suggestionsFrom ? (
            <RemoteSuggestions listId={listId} from={field.suggestionsFrom} extra={field.suggestions} />
          ) : field.suggestions?.length ? (
            <datalist id={listId}>
              {field.suggestions.map((w) => <option key={w} value={w} />)}
            </datalist>
          ) : null}
        </>
      )}
    </FormField>
  );
}
