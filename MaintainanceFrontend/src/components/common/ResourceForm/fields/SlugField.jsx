import { useEffect, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { slugify } from '@/helpers/slug';
import { FormField } from '../FormField';

/**
 * `{ type: 'slug', source: 'title', prefix?: '/services/' }` — the URL segment.
 *
 * On a new record it follows `source` until someone types into it. A saved slug is
 * a live URL, so it never moves on its own; "Regenerate" makes it follow again.
 * Devanagari is kept as-is (`helpers/slug.js`, a copy of the API's rule), and the
 * API adds -2, -3… on save if the slug is taken.
 */
export function SlugField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { setValue, formState } = useFormContext();
  const source = useWatch({ name: field.source });
  const saved = formState.defaultValues?.[field.name];
  // 'auto' follows the source only while there is no saved slug; 'follow' always; 'manual' never.
  const [mode, setMode] = useState('auto');
  const following = mode === 'follow' || (mode === 'auto' && !saved);
  const current = input.value ?? '';

  useEffect(() => {
    if (!following) return;
    const next = slugify(source);
    if (next !== current) setValue(field.name, next, { shouldDirty: true });
  }, [following, source, current, field.name, setValue]);

  const spec = {
    ...field,
    description: field.description ?? (following
      ? `Filled in from the ${field.source} until you change it.`
      : 'Changing a published slug breaks links to the old address.'),
  };

  return (
    <FormField id={id} field={spec} error={fieldState.error}>
      {(control) => (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring">
            {field.prefix ? (
              <span className="shrink-0 border-r bg-muted/40 px-3 py-2 text-xs text-muted-foreground" aria-hidden>{field.prefix}</span>
            ) : null}
            <Input
              {...control}
              ref={input.ref}
              name={input.name}
              value={current}
              disabled={field.disabled}
              autoComplete="off"
              spellCheck={false}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(e) => { setMode('manual'); input.onChange(e.target.value); }}
              onBlur={() => { input.onChange(slugify(current)); input.onBlur(); }}
            />
          </div>
          {!following && !field.disabled ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('follow')}>
              <RefreshCw aria-hidden /> Regenerate
            </Button>
          ) : null}
        </div>
      )}
    </FormField>
  );
}
