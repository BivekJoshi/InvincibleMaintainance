import { BsCalendar } from '@/components/common/BsCalendar';
import { Calendar } from '@/components/ui/calendar';
import { displayCalendar } from '@/helpers/displayCalendar';
import { parseDateString, toDateString } from '@/helpers/format';

/** `{ before, after }` (days) → react-day-picker's matchers. */
const adMatchers = (disabled) => [
  disabled?.before ? { before: parseDateString(disabled.before) } : null,
  disabled?.after ? { after: parseDateString(disabled.after) } : null,
].filter(Boolean);

/**
 * The calendar every date picker in the back office opens: AD (`ui/calendar`, react-day-picker) or BS
 * (`BsCalendar`), as the account menu's Calendar switch says (`helpers/displayCalendar`). Both take and give
 * Kathmandu `YYYY-MM-DD` days — a form stores what it always stored, whichever calendar picked it.
 *
 * @param {{
 *   mode?: 'single'|'range',
 *   selected?: string|{ from?: string, to?: string },
 *   onSelect: (value: string|undefined|{ from?: string, to?: string }) => void,
 *   defaultMonth?: string,
 *   disabled?: { before?: string, after?: string },
 *   calendar?: 'ad'|'bs',
 * }} props
 */
export function DateCalendar({ mode = 'single', selected, onSelect, defaultMonth, disabled, calendar = displayCalendar() }) {
  if (calendar === 'bs') {
    return <BsCalendar mode={mode} selected={selected} onSelect={onSelect} defaultMonth={defaultMonth} disabled={disabled} />;
  }
  const matchers = adMatchers(disabled);
  if (mode === 'range') {
    return (
      <Calendar
        mode="range"
        selected={{ from: parseDateString(selected?.from), to: parseDateString(selected?.to) }}
        defaultMonth={parseDateString(selected?.from ?? defaultMonth)}
        disabled={matchers.length ? matchers : undefined}
        onSelect={(range) => onSelect({ from: toDateString(range?.from), to: toDateString(range?.to) })}
      />
    );
  }
  return (
    <Calendar
      mode="single"
      selected={parseDateString(selected)}
      defaultMonth={parseDateString(selected ?? defaultMonth)}
      disabled={matchers.length ? matchers : undefined}
      onSelect={(day) => onSelect(toDateString(day))}
    />
  );
}
