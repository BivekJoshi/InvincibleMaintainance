import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useGetRecordQuery, useSearchRecordsQuery } from '@/api/lookupApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/helpers/utils';

/**
 * Picks one record from an admin list endpoint, searching it with `?q=` as you type.
 * The relation filter in `<DataTable>` and the relation field in `<ResourceForm>`
 * are both this. Search happens on the server (`shouldFilter={false}`), so it finds
 * rows beyond the first page.
 *
 * The selected record's label comes from the search results when it is in them, and
 * otherwise from `GET <path>/<id>` — an edit form opens with only the id.
 *
 * @param {object} props
 * @param {string} props.path                 admin list endpoint, e.g. '/admin/service-categories'
 * @param {string|null|undefined} props.value the selected id
 * @param {(id: string|null, record?: object) => void} props.onChange
 * @param {string|((row: object) => string)} [props.labelKey] field (or function) naming a row
 * @param {string} [props.valueKey]
 * @param {object} [props.params]             extra query params for the search
 * @param {boolean} [props.clearable]
 */
export function RecordCombobox({
  path,
  value,
  onChange,
  labelKey = 'name',
  valueKey = 'id',
  params,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing matches.',
  clearable = true,
  disabled,
  className,
  ...aria
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q);

  const labelOf = (row) => {
    if (!row) return '';
    return String((typeof labelKey === 'function' ? labelKey(row) : row[labelKey]) ?? row[valueKey] ?? '');
  };

  const { data: results = [], isFetching } = useSearchRecordsQuery({ path, q: debouncedQ, params }, { skip: !open });
  const fromResults = value ? results.find((row) => row[valueKey] === value) : undefined;
  const { data: fetched, isFetching: resolving } = useGetRecordQuery(
    { path, id: value },
    { skip: !value || Boolean(fromResults) },
  );
  const current = fromResults ?? fetched;

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(''); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', clearable && value && 'pr-14')}
            {...aria}
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {value ? (labelOf(current) || (resolving ? 'Loading…' : value)) : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder={searchPlaceholder} />
            <CommandList>
              {isFetching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching…
                </div>
              ) : (
                <CommandEmpty>{emptyText}</CommandEmpty>
              )}
              {!isFetching && results.length ? (
                <CommandGroup>
                  {results.map((row) => (
                    <CommandItem
                      key={row[valueKey]}
                      value={String(row[valueKey])}
                      onSelect={() => { onChange(row[valueKey], row); setOpen(false); setQ(''); }}
                    >
                      <Check className={cn(row[valueKey] === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <span className="truncate">{labelOf(row)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && value && !disabled ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
