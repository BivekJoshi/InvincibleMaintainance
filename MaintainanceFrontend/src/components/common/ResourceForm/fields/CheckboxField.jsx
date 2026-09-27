import { useController } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/helpers/utils';

/**
 * `{ type: 'checkbox' }` — a yes/no that is an explicit statement rather than a setting (Phase L4: "I approve this
 * below the minimum margin"): a checkbox with its label and description beside it. A setting that is on or off is
 * `switch`. `tone: 'warning'` puts it on the warning surface.
 */
export function CheckboxField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = fieldState.error?.message ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <div className={cn('flex items-start gap-3 rounded-lg border p-3', field.tone === 'warning' && 'surface-warning')}>
        <Checkbox
          id={id}
          ref={input.ref}
          name={input.name}
          checked={Boolean(input.value)}
          onCheckedChange={(checked) => input.onChange(checked === true)}
          onBlur={input.onBlur}
          disabled={field.disabled}
          className="mt-0.5"
          aria-invalid={fieldState.error ? true : undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
        />
        <div className="min-w-0 space-y-1">
          <Label htmlFor={id} required={field.required}>{field.label}</Label>
          {field.description ? <p id={descriptionId} className="text-xs opacity-80">{field.description}</p> : null}
        </div>
      </div>
      {errorId ? <p id={errorId} className="text-xs font-medium text-destructive">{fieldState.error.message}</p> : null}
    </div>
  );
}
