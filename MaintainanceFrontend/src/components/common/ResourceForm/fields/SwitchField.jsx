import { useController } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** `{ type: 'switch' }` — on/off, with the label and description beside the switch. */
export function SwitchField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = fieldState.error?.message ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={id}>{field.label}</Label>
          {field.description ? <p id={descriptionId} className="text-xs text-muted-foreground">{field.description}</p> : null}
        </div>
        <Switch
          id={id}
          ref={input.ref}
          name={input.name}
          checked={Boolean(input.value)}
          onCheckedChange={input.onChange}
          onBlur={input.onBlur}
          disabled={field.disabled}
          aria-invalid={fieldState.error ? true : undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
        />
      </div>
      {errorId ? <p id={errorId} className="text-xs font-medium text-destructive">{fieldState.error.message}</p> : null}
    </div>
  );
}
