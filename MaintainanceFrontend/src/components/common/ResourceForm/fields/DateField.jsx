import { useState } from 'react';
import { useController } from 'react-hook-form';
import { CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  formatDate, fromKathmanduParts, parseDateString, toDateString, toKathmanduParts,
} from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/**
 * `{ type: 'date', time? }` — a calendar day. The value is a UTC ISO string for the start
 * of that day in Kathmandu (or `time`, `HH:mm` — `'23:59'` for "valid until" days), so the
 * day reads the same in the admin, on the site and in the database whatever timezone the
 * editor's laptop is set to.
 */
export function DateField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [open, setOpen] = useState(false);
  const { date } = toKathmanduParts(input.value);

  return (
    <FormField id={id} field={field} error={fieldState.error}>
      {(control) => (
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) input.onBlur(); }}>
            <PopoverTrigger asChild>
              <Button
                {...control}
                ref={input.ref}
                type="button"
                variant="outline"
                disabled={field.disabled}
                className={cn('w-full justify-start font-normal sm:w-[240px]', !date && 'text-muted-foreground')}
              >
                <CalendarIcon aria-hidden />
                {date ? formatDate(input.value) : field.placeholder ?? 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDateString(date)}
                defaultMonth={parseDateString(date)}
                onSelect={(day) => {
                  input.onChange(day ? fromKathmanduParts(toDateString(day), field.time) : undefined);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {date && !field.required && !field.disabled ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => input.onChange(undefined)} aria-label={`Clear ${field.label ?? 'date'}`}>
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
      )}
    </FormField>
  );
}
