import { useState } from 'react';
import { useController } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendar } from '@/components/common/DateCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { displayCalendar } from '@/helpers/displayCalendar';
import { formatDate, fromKathmanduParts, toKathmanduParts } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { FormField } from '../FormField';

/**
 * `{ type: 'datetime', defaultTime? }` — a moment. It is shown and typed in
 * Kathmandu time and stored as the UTC ISO string the API expects, whatever
 * timezone the browser is in. A day picked before a time gets `defaultTime` (09:00). The day's calendar is AD or BS
 * as the account menu says (`DateCalendar`); the time is the same either way.
 */
export function DateTimeField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [open, setOpen] = useState(false);
  const { date, time } = toKathmanduParts(input.value);
  const nepali = displayCalendar() === 'bs';
  const spec = { ...field, description: field.description ?? 'Nepal time (UTC+05:45).' };

  return (
    <FormField id={id} field={spec} error={fieldState.error}>
      {(control) => (
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) input.onBlur(); }}>
            <PopoverTrigger asChild>
              <Button
                {...control}
                ref={input.ref}
                type="button"
                variant="outline"
                disabled={field.disabled}
                className={cn('w-full justify-start font-normal sm:w-[220px]', !date && 'text-muted-foreground')}
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
                  input.onChange(day ? fromKathmanduParts(day, time || field.defaultTime || '09:00') : undefined);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={time}
            disabled={field.disabled || !date}
            onChange={(e) => input.onChange(fromKathmanduParts(date, e.target.value) ?? undefined)}
            onBlur={input.onBlur}
            className="w-[120px] tabular-nums"
            aria-label={`${field.label ?? 'Date'} — time`}
            aria-invalid={fieldState.error ? true : undefined}
          />
        </div>
      )}
    </FormField>
  );
}
