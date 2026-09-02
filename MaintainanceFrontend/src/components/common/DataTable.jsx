import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Search, Inbox } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { cn } from '@/lib/utils';

/**
 * The one table in this app. Server-side pagination, sorting and search — the API
 * already speaks `?page&limit&sort&q`, so this component just drives those params.
 *
 * @param {object} props
 * @param {{key:string,header:string,sortable?:boolean,className?:string,cell?:(row)=>any}[]} props.columns
 * @param {{items:any[],meta:{page,limit,total,pages}}} props.data
 * @param {(params:object)=>void} props.onParamsChange
 */
export function DataTable({
  columns,
  data,
  meta,
  isLoading,
  isFetching,
  error,
  params = {},
  onParamsChange,
  onRowClick,
  searchPlaceholder = 'Search…',
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  toolbar,
  refetch,
}) {
  const [search, setSearch] = useState(params.q ?? '');

  const setParam = (patch) => onParamsChange?.({ ...params, page: 1, ...patch });

  const toggleSort = (key) => {
    const current = params.sort ?? '';
    const next = current === key ? `-${key}` : current === `-${key}` ? '' : key;
    onParamsChange?.({ ...params, sort: next || undefined });
  };

  const sortIcon = (key) => {
    if (params.sort === key) return <ArrowUp className="h-3 w-3" />;
    if (params.sort === `-${key}`) return <ArrowDown className="h-3 w-3" />;
    return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setParam({ q: search || undefined });
  };

  const page = meta?.page ?? 1;
  const pages = meta?.pages ?? 1;
  const total = meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label="Search"
          />
        </form>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>

      <div className="relative overflow-hidden rounded-xl border">
        {/* A refetch dims the table instead of replacing it, so the page never jumps. */}
        <AnimatePresence>
          {isFetching && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/20"
            >
              <motion.div
                className="h-full w-1/3 bg-primary"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={columns.length} />
        ) : !data?.length ? (
          <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        {col.header}
                        {sortIcon(col.key)}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <motion.tr
                  key={row.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b transition-colors last:border-0 hover:bg-muted/50',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell ? col.cell(row) : row[col.key] ?? '—'}
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages} · {total.toLocaleString()} record{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" disabled={page <= 1}
              onClick={() => onParamsChange?.({ ...params, page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline" size="sm" disabled={page >= pages}
              onClick={() => onParamsChange?.({ ...params, page: page + 1 })}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
