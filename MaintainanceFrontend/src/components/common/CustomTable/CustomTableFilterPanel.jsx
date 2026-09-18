import { Check, SlidersHorizontal, X } from 'lucide-react';
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RecordCombobox } from '@/components/common/RecordCombobox';
import { useGetRecordQuery } from '@/api/lookupApi';
import { formatDate, toKathmanduParts } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import {
  DateRangeFilter, TextFilter, clearFiltersPatch, filterKeys, isFilterSet,
} from './CustomTableFilters';

/** Dot colours an option may ask for with `tone`. Tokens only — no hex. */
const TONE_DOT = {
  danger: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
  info: 'bg-primary',
  muted: 'bg-muted-foreground',
};

/** Kathmanduʼs calendar day, `YYYY-MM-DD`, `days` from `now`. */
const ktmDay = (now, days = 0) => toKathmanduParts(new Date(now.getTime() + days * 86_400_000).toISOString()).date;

/** One-tap ranges offered above a date range's calendar, in Kathmandu days. */
const QUICK_RANGES = [
  { key: 'today', label: 'Today', range: (now) => [ktmDay(now), ktmDay(now)] },
  { key: '7d', label: 'Last 7 days', range: (now) => [ktmDay(now, -6), ktmDay(now)] },
  { key: '30d', label: 'Last 30 days', range: (now) => [ktmDay(now, -29), ktmDay(now)] },
  { key: 'month', label: 'This month', range: (now) => [`${ktmDay(now).slice(0, 8)}01`, ktmDay(now)] },
];

/** The choices an enum or boolean filter offers. */
const choicesOf = (filter) => (filter.type === 'boolean'
  ? [{ value: 'true', label: filter.trueLabel ?? 'Yes' }, { value: 'false', label: filter.falseLabel ?? 'No' }]
  : filter.options ?? []);

/** A tap-to-pick pill. Tapping the picked one again clears it. */
function Chip({ active, tone, children, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted',
        className,
      )}
      {...props}
    >
      {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : tone ? <span className={cn('h-2 w-2 rounded-full', TONE_DOT[tone])} aria-hidden /> : null}
      {children}
    </button>
  );
}

function ChipGroup({ filter, value, onChange }) {
  const current = value ?? filter.defaultValue;
  return (
    <div role="group" aria-label={filter.label} className="flex flex-wrap gap-2">
      {choicesOf(filter).map((o) => {
        const active = String(current ?? '') === String(o.value);
        return (
          <Chip
            key={o.value} tone={o.tone} active={active}
            onClick={() => onChange({ [filter.key]: active && filter.defaultValue == null ? undefined : o.value })}
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}

function DateRangeSection({ filter, params, onChange }) {
  const [fromKey, toKey] = filterKeys(filter);
  const now = new Date();
  return (
    <div className="space-y-2">
      <div role="group" aria-label={`${filter.label} quick ranges`} className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((q) => {
          const [from, to] = q.range(now);
          const active = params[fromKey] === from && params[toKey] === to;
          return (
            <Chip
              key={q.key} active={active}
              onClick={() => onChange(active ? { [fromKey]: undefined, [toKey]: undefined } : { [fromKey]: from, [toKey]: to })}
            >
              {q.label}
            </Chip>
          );
        })}
      </div>
      <DateRangeFilter filter={{ ...filter, label: 'Custom range', className: 'w-full' }} params={params} onChange={onChange} />
    </div>
  );
}

function FilterSection({ filter, params, onChange }) {
  const set = isFilterSet(filter, params);
  const clear = () => onChange(Object.fromEntries(filterKeys(filter).map((k) => [k, filter.defaultValue ?? undefined])));
  let body;
  switch (filter.type) {
    case 'enum':
    case 'boolean':
      body = <ChipGroup filter={filter} value={params[filter.key]} onChange={onChange} />;
      break;
    case 'relation':
      body = (
        <RecordCombobox
          {...filter.relation}
          value={params[filter.key]}
          onChange={(id) => onChange({ [filter.key]: id ?? undefined })}
          fixedOptions={filter.fixedOptions}
          placeholder={filter.placeholder ?? `Any ${filter.label.toLowerCase()}`}
          aria-label={filter.label}
          className="w-full"
        />
      );
      break;
    case 'dateRange':
      body = <DateRangeSection filter={filter} params={params} onChange={onChange} />;
      break;
    case 'text':
      body = <TextFilter filter={{ ...filter, className: 'w-full' }} value={params[filter.key]} onChange={onChange} />;
      break;
    default:
      return null;
  }
  return (
    <section className="space-y-2.5 border-b pb-5 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {filter.label}
          {filter.hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{filter.hint}</span> : null}
        </h3>
        {set ? (
          <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            Reset
          </button>
        ) : null}
      </div>
      {body}
    </section>
  );
}

/**
 * The "Filters" button and its side panel: the same declarative `filters` as the inline
 * bar, laid out as tap-to-pick chips in sections, for lists with too many filters to sit
 * in one row. Every change writes to the URL at once, so the list updates behind the panel.
 */
export function CustomTableFilterPanel({ filters, params, onChange, title = 'Filters', description }) {
  const count = filters.filter((f) => isFilterSet(f, params)).length;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant={count ? 'secondary' : 'outline'} size="sm" aria-label={count ? `${title}, ${count} applied` : title}>
          <SlidersHorizontal aria-hidden /> {title}
          {count ? (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description ?? 'Pick what to show. The list updates as you go.'}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {filters.map((f) => <FilterSection key={f.key} filter={f} params={params} onChange={onChange} />)}
        </div>
        <SheetFooter className="flex-row items-center justify-between border-t px-6 py-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" disabled={!count} onClick={() => onChange(clearFiltersPatch(filters))}>
            Clear all
          </Button>
          <SheetClose asChild>
            <Button type="button" size="sm">Show results</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** A relation's chip label: a fixed option's, or the record's name looked up by id. */
function RelationLabel({ filter, id }) {
  const fixed = filter.fixedOptions?.find((o) => o.value === id);
  const { data } = useGetRecordQuery({ path: filter.relation.path, id }, { skip: Boolean(fixed) });
  if (fixed) return fixed.label;
  const { labelKey = 'name' } = filter.relation;
  return (data && (typeof labelKey === 'function' ? labelKey(data) : data[labelKey])) || '…';
}

function valueLabel(filter, params) {
  switch (filter.type) {
    case 'enum':
    case 'boolean':
      return choicesOf(filter).find((o) => String(o.value) === String(params[filter.key]))?.label ?? params[filter.key];
    case 'relation':
      return <RelationLabel filter={filter} id={params[filter.key]} />;
    case 'dateRange': {
      const [fromKey, toKey] = filterKeys(filter);
      const now = new Date();
      const quick = QUICK_RANGES.find((q) => {
        const [from, to] = q.range(now);
        return params[fromKey] === from && params[toKey] === to;
      });
      if (quick) return quick.label;
      const short = (d) => (d ? formatDate(d, { year: undefined }) : '…');
      return `${short(params[fromKey])} – ${short(params[toKey])}`;
    }
    default:
      return params[filter.key];
  }
}

/** The applied filters as removable chips, under the toolbar. Renders nothing when none are. */
export function CustomTableActiveFilters({ filters, params, onChange }) {
  const applied = filters.filter((f) => isFilterSet(f, params));
  if (!applied.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters" role="list">
      {applied.map((f) => (
        <span
          key={f.key} role="listitem"
          className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pl-3 pr-1 text-xs"
        >
          <span className="text-muted-foreground">{f.label}:</span>
          <span className="font-medium">{valueLabel(f, params)}</span>
          <button
            type="button"
            onClick={() => onChange(Object.fromEntries(filterKeys(f).map((k) => [k, f.defaultValue ?? undefined])))}
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            aria-label={`Remove ${f.label} filter`}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      {applied.length > 1 ? (
        <button
          type="button" onClick={() => onChange(clearFiltersPatch(filters))}
          className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
