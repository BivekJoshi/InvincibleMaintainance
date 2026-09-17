import { useController } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/** 0 = Sunday … 6 = Saturday, as JavaScript's `getDay()` and the booking rules count them. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * `{ type: 'weekdays' }` — a set of days of the week, as a sorted array of day numbers
 * (0 = Sunday … 6 = Saturday). One checkbox per day.
 */
export function WeekdaysField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const days = Array.isArray(input.value) ? input.value.map(Number) : [];

  const toggle = (day, on) => {
    const next = new Set(days);
    if (on) next.add(day); else next.delete(day);
    input.onChange([...next].sort((a, b) => a - b));
    input.onBlur();
  };

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {() => (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, day) => {
            const checked = days.includes(day);
            const boxId = `${id}-${day}`;
            return (
              <label
                key={name}
                htmlFor={boxId}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50',
                  field.disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <Checkbox
                  id={boxId}
                  ref={day === 0 ? input.ref : undefined}
                  checked={checked}
                  disabled={field.disabled}
                  onCheckedChange={(v) => toggle(day, v === true)}
                />
                {name}
              </label>
            );
          })}
        </div>
      )}
    </FormField>
  );
}
