import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { useGetRecordHistoryQuery } from '@/api/historyApi';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { DataTablePagination } from '@/components/common/DataTable/DataTablePagination';
import { describeHistoryEntry, diffRows, fieldLabel, foldHistory, formatDiffValue } from '@/helpers/history';
import { formatDateTime, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const ACTOR_WORDS = { public: 'Customer (website or link)', system: 'System' };

function actorOf(entry) {
  if (entry.actor) return `${entry.actor.name} · ${titleCase(entry.actor.role)}`;
  return ACTOR_WORDS[entry.actorType] ?? 'Unknown';
}

function HistoryItem({ entry }) {
  const [open, setOpen] = useState(false);
  const { label, detail } = describeHistoryEntry(entry);
  const rows = diffRows(entry.before, entry.after, entry.changes);
  const panelId = `history-diff-${entry.id}`;

  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" aria-hidden />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <time dateTime={entry.createdAt} className="text-xs tabular-nums text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </time>
      </div>
      {detail ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{detail}</p> : null}
      <p className="mt-0.5 text-xs text-muted-foreground">{actorOf(entry)}</p>
      {rows.length ? (
        <>
          <Button
            type="button" variant="ghost" size="sm" className="-ml-2 mt-1 h-7 px-2 text-xs"
            aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
            {open ? 'Hide details' : 'Show details'}
          </Button>
          {open ? (
            <div id={panelId} className="mt-1 overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr><th className="px-2 py-1 font-medium">Field</th><th className="px-2 py-1 font-medium">Before</th><th className="px-2 py-1 font-medium">After</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.field} className="border-t align-top">
                      <th scope="row" className="px-2 py-1 text-left font-medium">{fieldLabel(r.field)}</th>
                      <td className="break-all px-2 py-1 text-muted-foreground">{formatDiffValue(r.before)}</td>
                      <td className="break-all px-2 py-1">{formatDiffValue(r.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * A record's History tab: every audited step, newest first — what happened, who did it
 * (name and role), when (Kathmandu time), and an expandable before/after of the fields.
 * A request's plain row writes fold into its named event (`foldHistory`), so a status
 * change reads once.
 *
 * `endpoint` is the record's history URL (`/admin/leads/:id/history`); any record with a
 * history scope in the API works the same way.
 *
 * @param {{ endpoint: string, pageSize?: number, className?: string }} props
 */
export function RecordHistory({ endpoint, pageSize = 20, className }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const { data, isLoading, isFetching, error, refetch } = useGetRecordHistoryQuery({ endpoint, page, limit });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading history">
        <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
      </div>
    );
  }
  const items = foldHistory(data?.items);
  if (!items.length) {
    return <EmptyState icon={History} title="No history yet" description="Every change to this record will be listed here." />;
  }
  const meta = data.meta;

  return (
    <div className={cn('space-y-4', className)}>
      <ol className={cn('space-y-5 border-l pl-0 [&>li]:-ml-[5px]', isFetching && 'opacity-60')} aria-label="History">
        {items.map((entry) => <HistoryItem key={entry.id} entry={entry} />)}
      </ol>
      {meta?.total > limit || page > 1 ? (
        <DataTablePagination
          page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit}
          pageSizes={[10, 20, 50, 100]}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      ) : null}
    </div>
  );
}
