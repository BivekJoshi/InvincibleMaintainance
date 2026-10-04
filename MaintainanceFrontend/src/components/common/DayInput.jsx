import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { DateCalendar } from '@/components/common/DateCalendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { displayCalendar } from '@/helpers/displayCalendar';
import { formatDate, fromKathmanduParts } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/**
 * A day as a field outside `ResourceForm` takes it — the visit dialog's date, the dispatch board's day: a button that
 * opens `DateCalendar` (AD or BS, as the account menu says) and gives back a Kathmandu `YYYY-MM-DD` string, the value
 * an `<input type="date">` gave before it. `min` / `max` are days too.
 *
 * @param {{ id?: string, value?: string, onChange: (day: string) => void, min?: string, max?: string,
 *   placeholder?: string, className?: string, 'aria-invalid'?: boolean, 'aria-describedby'?: string }} props
 */
export function DayInput({ id, value, onChange, min, max, placeholder = 'Pick a date', className, ...aria }) {
  const [open, setOpen] = useState(false);
  const iso = value ? fromKathmanduParts(value, '12:00') : null;
  const nepali = displayCalendar() === 'bs';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn('w-full justify-start gap-2 font-normal', !value && 'text-muted-foreground', className)}
          {...aria}
        >
          <CalendarIcon aria-hidden />
          {iso ? <span lang={nepali ? 'ne' : undefined}>{formatDate(iso)}</span> : placeholder}
          {iso && nepali ? <span className="ml-auto text-xs text-muted-foreground">{formatDate(iso, { calendar: 'ad', year: undefined })}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DateCalendar
          mode="single"
          selected={value || undefined}
          disabled={{ before: min, after: max }}
          onSelect={(day) => {
            if (day) onChange(day);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
