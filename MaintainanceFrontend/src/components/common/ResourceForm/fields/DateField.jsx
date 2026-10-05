import { useState } from 'react';
import { useController } from 'react-hook-form';
import { CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendar } from '@/components/common/DateCalendar';
import { Button } from '@/components/ui/button';
import { displayCalendar } from '@/helpers/displayCalendar';
import { formatDate, fromKathmanduParts, toKathmanduParts } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/**
 * `{ type: 'date', time? }` — a calendar day. The value is a UTC ISO string for the start
 * of that day in Kathmandu (or `time`, `HH:mm` — `'23:59'` for "valid until" days), so the
 * day reads the same in the admin, on the site and in the database whatever timezone the
 * editor's laptop is set to. The calendar is AD or BS as the account menu says (`DateCalendar`); in BS the button
 * shows the AD date beside the Nepali one.
 */
export function DateField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [open, setOpen] = useState(false);
  const { date } = toKathmanduParts(input.value);
  const nepali = displayCalendar() === 'bs';

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
                {date ? <span lang={nepali ? 'ne' : undefined}>{formatDate(input.value)}</span> : field.placeholder ?? 'Pick a date'}
                {date && nepali ? <span className="ml-auto text-xs text-muted-foreground">{formatDate(input.value, { calendar: 'ad', year: undefined })}</span> : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DateCalendar
                mode="single"
                selected={date || undefined}
                onSelect={(day) => {
                  input.onChange(day ? fromKathmanduParts(day, field.time) : undefined);
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
