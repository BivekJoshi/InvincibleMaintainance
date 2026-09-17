import { useController } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/**
 * `{ type: 'checklist', options: [{ value, label, description?, disabled? }], emptyText? }` — several
 * values ticked from a list (the technicians on a job). The value is an array of option values,
 * kept in the order the options are listed, whatever order they were ticked in. A ticked value
 * that is no longer among the options (someone switched off since) stays ticked and is shown.
 */
export function ChecklistField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const selected = Array.isArray(input.value) ? input.value : [];
  const options = field.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const rows = [
    ...options,
    ...selected.filter((v) => !known.has(v)).map((value) => ({ value, label: field.unknownLabel?.(value) ?? value })),
  ];

  const toggle = (value, on) => {
    const next = new Set(selected);
    if (on) next.add(value); else next.delete(value);
    input.onChange(rows.map((o) => o.value).filter((v) => next.has(v)));
    input.onBlur();
  };

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {() => (rows.length ? (
        <div className={cn('grid gap-2', rows.length > 4 && 'max-h-64 overflow-y-auto pr-1')}>
          {rows.map((option, i) => {
            const checked = selected.includes(option.value);
            const boxId = `${id}-${i}`;
            const disabled = field.disabled || (option.disabled && !checked);
            return (
              <label
                key={option.value}
                htmlFor={boxId}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                  checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <Checkbox
                  id={boxId}
                  ref={i === 0 ? input.ref : undefined}
                  className="mt-0.5"
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(option.value, v === true)}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  {option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : <p className="text-sm text-muted-foreground">{field.emptyText ?? 'Nothing to choose from.'}</p>)}
    </FormField>
  );
}
