import { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { formatDate, parseDateString, toDateString } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** Radix Select cannot hold an empty value, so "no filter" needs a sentinel. */
const ALL = '__all';

/** The URL keys a filter writes. A date range writes two. */
const filterKeys = (filter) => (filter.type === 'dateRange'
  ? [filter.fromKey ?? 'from', filter.toKey ?? 'to']
  : [filter.key]);

/**
 * A filter with a `defaultValue` always has a value (the list opens on it, and the
 * page puts it in the list params), so it offers no "all" of its own — an explicit
 * option such as `{ value: 'all', label: 'All' }` does that job.
 */
function ChoiceFilter({ filter, value, onChange, options, allLabel }) {
  const hasDefault = filter.defaultValue != null;
  const current = value ?? filter.defaultValue;
  return (
    <Select value={current == null ? ALL : String(current)} onValueChange={(v) => onChange({ [filter.key]: v === ALL ? undefined : v })}>
      <SelectTrigger className={cn('w-[160px]', filter.className)} aria-label={filter.label}>
        <SelectValue placeholder={filter.label} />
      </SelectTrigger>
      <SelectContent>
        {hasDefault ? null : <SelectItem value={ALL}>{filter.allLabel ?? allLabel}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function DateRangeFilter({ filter, params, onChange }) {
  const [open, setOpen] = useState(false);
  const [fromKey, toKey] = filterKeys(filter);
  const from = params[fromKey];
  const to = params[toKey];
  const short = (d) => formatDate(d, { year: undefined });
  const label = from || to ? `${from ? short(from) : '…'} – ${to ? short(to) : '…'}` : filter.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-9 justify-start font-normal', !(from || to) && 'text-muted-foreground', filter.className)}
          aria-label={`${filter.label} date range: ${from || to ? label : 'any'}`}
        >
          <CalendarRange aria-hidden /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from: parseDateString(from), to: parseDateString(to) }}
          defaultMonth={parseDateString(from)}
          onSelect={(range) => onChange({ [fromKey]: toDateString(range?.from), [toKey]: toDateString(range?.to) })}
        />
        <div className="flex justify-end gap-2 border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange({ [fromKey]: undefined, [toKey]: undefined }); setOpen(false); }}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The declarative filter bar. Each filter reads its value from the list params and
 * writes a patch back, so every filter lives in the URL through `useListParams`.
 *
 * @param {object} props
 * A filter's `defaultValue` is where the list starts (the testimonial queue opens on
 * "Waiting for approval"); "Clear filters" returns to it, and it does not count as a
 * filter someone applied.
 *
 * @param {{ key: string, label: string, type: 'enum'|'relation'|'dateRange'|'boolean',
 *   options?: { value: string, label: string }[], relation?: object, allLabel?: string, defaultValue?: string,
 *   trueLabel?: string, falseLabel?: string, fromKey?: string, toKey?: string, className?: string }[]} props.filters
 * @param {object} props.params
 * @param {(patch: object) => void} props.onChange
 */
export function DataTableFilters({ filters, params, onChange }) {
  const isSet = (f, k) => params[k] != null && params[k] !== '' && String(params[k]) !== String(f.defaultValue ?? '');
  const active = filters.some((f) => filterKeys(f).some((k) => isSet(f, k)));

  return (
    <>
      {filters.map((filter) => {
        switch (filter.type) {
          case 'enum':
            return (
              <ChoiceFilter
                key={filter.key} filter={filter} value={params[filter.key]} onChange={onChange}
                options={filter.options ?? []} allLabel={`All ${filter.label.toLowerCase()}`}
              />
            );
          case 'boolean':
            return (
              <ChoiceFilter
                key={filter.key} filter={filter} value={params[filter.key]} onChange={onChange}
                options={[{ value: 'true', label: filter.trueLabel ?? 'Yes' }, { value: 'false', label: filter.falseLabel ?? 'No' }]}
                allLabel={`Any ${filter.label.toLowerCase()}`}
              />
            );
          case 'relation':
            return (
              <RecordCombobox
                key={filter.key}
                {...filter.relation}
                value={params[filter.key]}
                onChange={(id) => onChange({ [filter.key]: id ?? undefined })}
                fixedOptions={filter.fixedOptions}
                placeholder={filter.label}
                aria-label={filter.label}
                className={cn('w-[200px]', filter.className)}
              />
            );
          case 'dateRange':
            return <DateRangeFilter key={filter.key} filter={filter} params={params} onChange={onChange} />;
          default:
            return null;
        }
      })}
      {active ? (
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => onChange(Object.fromEntries(filters.flatMap(filterKeys).map((k) => [k, undefined])))}
        >
          <X aria-hidden /> Clear filters
        </Button>
      ) : null}
    </>
  );
}
