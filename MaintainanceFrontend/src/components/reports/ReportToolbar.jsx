import { useMemo } from 'react';
import { DateRangeFilter } from '@/components/common/CustomTable/CustomTableFilters';
import { Button } from '@/components/ui/button';
import { formatDateBs } from '@/helpers/format';
import { reportRangePresets } from '@/helpers/finance';
import { cn } from '@/helpers/utils';
import { ReportCsvButton } from './ReportCsvButton';

const RANGE_FILTER = { key: 'range', label: 'Dates', type: 'dateRange' };

/**
 * The bar above every report (Phase I — the finance reports and `/admin/reports` share it): the date range (the kit's
 * `DateRangeFilter`, Kathmandu days in the URL as `from` / `to`), one-click ranges — the last 30 or 90 days and **this
 * fiscal year** (from Shrawan 1) — the range again in BS, whatever else the report filters by (`children`: a grouping),
 * and its **CSV**, which asks the API for the same filters.
 *
 * @param {{ params: object, onChange: (patch: object) => void, csv?: { path: string, params?: object, name: string } | null,
 *   dated?: boolean, note?: import('react').ReactNode, children?: import('react').ReactNode, className?: string }} props
 *   `dated: false` — a report that is "as of now" (aging) shows `note` instead of the range
 */
export function ReportToolbar({ params, onChange, csv, dated = true, note, children, className }) {
  const presets = useMemo(() => reportRangePresets(), []);
  const bs = [params.from, params.to].map((d) => (d ? formatDateBs(d) : '…')).join(' – ');

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)} data-testid="report-toolbar">
      {dated ? (
        <>
          <DateRangeFilter filter={RANGE_FILTER} params={params} onChange={onChange} />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Quick ranges">
            {presets.map((p) => {
              const on = params.from === p.from && params.to === p.to;
              return (
                <Button
                  key={p.key} type="button" size="sm" variant={on ? 'secondary' : 'ghost'} aria-pressed={on}
                  onClick={() => onChange({ from: p.from, to: p.to })}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
          {params.from || params.to ? <span className="text-xs tabular-nums text-muted-foreground" data-testid="range-bs">{bs} BS</span> : null}
        </>
      ) : note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      {children}
      {csv ? <div className="ml-auto"><ReportCsvButton {...csv} /></div> : null}
    </div>
  );
}
