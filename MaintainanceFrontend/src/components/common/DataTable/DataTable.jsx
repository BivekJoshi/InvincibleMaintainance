import { Fragment, useEffect, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, ChevronsUpDown, Inbox, RotateCcw, Search, Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { arrayMove } from '@dnd-kit/sortable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/helpers/utils';
import { DataTableFilters } from './DataTableFilters';
import { DataTablePagination } from './DataTablePagination';
import { DataTableReorderBody } from './DataTableReorderBody';
import { DataTableRowActions } from './DataTableRowActions';

const PAGE_SIZES = [10, 20, 50, 100];
const rowIdOf = (row) => row.id;

/**
 * The one table in this app. Server-side pagination, sorting, search and filters —
 * the API already speaks `?page&limit&sort&q`, so this component drives those
 * params and `useListParams` keeps them in the URL.
 *
 * Everything past the basics is opt-in:
 *
 * - `rowActions(row)`  → a kebab menu per row.
 * - `bulkActions`      → a checkbox column, select-all-on-page and a bar of actions
 *                        for the selection. Selection clears when the page or filters change.
 * - `filters`          → the filter bar (enum, relation, dateRange, boolean).
 * - `trash`            → a Trash toggle (`?deleted=true`) whose rows offer Restore, and
 *                        Delete forever to anyone with `cms:purge`.
 * - `reorderable`      → a Reorder mode: drag handles plus Move up / Move down. The new
 *                        order shows at once; if `onReorder` rejects, it snaps back.
 * - `expandable`       → a disclosure button per row; an open row shows `render(row)` beneath
 *                        it, across the table (an audit row's before/after).
 *
 * @param {object} props
 * @param {{ key: string, header: string, sortable?: boolean, className?: string, cell?: (row: object) => any }[]} props.columns
 * @param {object[]|undefined} props.data  the rows of the current page (the API's `data` array)
 * @param {{ page: number, limit: number, total: number, pages: number }} [props.meta]
 * @param {object} [props.params]          current list params, from `useListParams`
 * @param {(params: object) => void} props.onParamsChange
 * @param {(row: object) => void} [props.onRowClick]
 * @param {(row: object) => string} [props.getRowId]
 * @param {(row: object) => object[]} [props.rowActions] see `DataTableRowActions`
 * @param {{ label: string, icon?: import('react').ElementType, destructive?: boolean,
 *   onSelect: (rows: object[], clearSelection: () => void) => void }[]} [props.bulkActions]
 * @param {number[]} [props.pageSizes]
 * @param {object[]} [props.filters] see `DataTableFilters`
 * @param {{ onRestore: (row: object) => void, onPurge?: (row: object) => void, canPurge?: boolean }} [props.trash]
 * @param {boolean} [props.reorderable]
 * @param {string} [props.reorderDisabledReason] when set and the table is not reorderable, a disabled
 *   Reorder button says why (list items reorder one group at a time)
 * @param {(items: { id: string, sortOrder: number }[]) => Promise<unknown>|void} [props.onReorder]
 *   the new order of this page, offset by the rows on earlier pages — the body `PATCH /reorder` takes
 * @param {(row: object, index: number) => string} [props.rowLabel] names a row for screen readers in reorder mode
 * @param {boolean} [props.searchable] false hides the search box (a short list that is already complete)
 * @param {{ render: (row: object) => import('react').ReactNode }} [props.expandable]
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
  getRowId = rowIdOf,
  rowActions,
  bulkActions,
  pageSizes = PAGE_SIZES,
  filters,
  trash,
  reorderable = false,
  reorderDisabledReason,
  onReorder,
  rowLabel,
  searchable = true,
  expandable,
}) {
  const { can } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState(params.q ?? '');
  const [selected, setSelected] = useState(() => new Set());
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  // The URL is the source of truth: Back, a shared link or "Clear filters" all change q without typing.
  useEffect(() => { setSearch(params.q ?? ''); }, [params.q]);

  // A new page of rows replaces any optimistic order, and drops selections that are no longer on screen.
  useEffect(() => {
    setOrder(null);
    setSelected((prev) => {
      if (!prev.size) return prev;
      const onPage = new Set((data ?? []).map(getRowId));
      const next = new Set([...prev].filter((id) => onPage.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data, getRowId]);

  // Reorder mode ends if the table stops being reorderable (a required filter went away).
  useEffect(() => { if (!reorderable) setReordering(false); }, [reorderable]);

  const paramsKey = JSON.stringify(params);
  useEffect(() => { setSelected(new Set()); setExpanded(new Set()); }, [paramsKey]);

  const inTrash = params.deleted === 'true' || params.deleted === true;
  const rows = order ?? data ?? [];

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

  const toggleTrash = () => {
    setReordering(false);
    setParam({ deleted: inTrash ? undefined : 'true' });
  };

  const toggleReorder = () => {
    setSelected(new Set());
    // The manual order only means something in the list's own order, not sorted by a column.
    if (!reordering && params.sort) onParamsChange?.({ ...params, sort: undefined });
    setReordering((r) => !r);
  };

  const move = async (from, to) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const previous = rows;
    const next = arrayMove(rows, from, to);
    setOrder(next);
    const limit = meta?.limit ?? params.limit ?? next.length;
    const offset = ((meta?.page ?? params.page ?? 1) - 1) * limit;
    try {
      await onReorder?.(next.map((row, i) => ({ id: getRowId(row), sortOrder: offset + i })));
    } catch {
      setOrder(previous);
    }
  };

  const showSelect = Boolean(bulkActions?.length) && !inTrash && !reordering;
  const showActions = !reordering && (inTrash ? Boolean(trash) : Boolean(rowActions));
  const clickable = Boolean(onRowClick) && !inTrash;
  const showExpand = Boolean(expandable) && !reordering;
  const toggleExpanded = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const trashActionsFor = (row) => [
    { label: 'Restore', icon: RotateCcw, onSelect: () => trash.onRestore?.(row) },
    ...(trash.onPurge && (trash.canPurge ?? can('cms:purge'))
      ? [{
        label: 'Delete forever',
        icon: Trash2,
        destructive: true,
        onSelect: async () => {
          const ok = await confirm({
            title: 'Delete this for good?',
            description: 'It is removed permanently and cannot be restored.',
            confirmLabel: 'Delete forever',
            destructive: true,
          });
          if (ok) trash.onPurge(row);
        },
      }]
      : []),
  ];

  const ids = rows.map(getRowId);
  const selectedOnPage = ids.filter((id) => selected.has(id)).length;
  const allSelected = ids.length > 0 && selectedOnPage === ids.length;
  const selectedRows = rows.filter((row) => selected.has(getRowId(row)));
  const clearSelection = () => setSelected(new Set());

  const toggleRow = (id, checked) => setSelected((prev) => {
    const next = new Set(prev);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });

  const toggleAll = (checked) => setSelected(checked ? new Set(ids) : new Set());

  const page = meta?.page ?? 1;
  const pages = meta?.pages ?? 1;
  const total = meta?.total ?? 0;
  const limit = meta?.limit ?? params.limit ?? 20;
  const columnCount = columns.length + (showSelect ? 1 : 0) + (showActions ? 1 : 0) + (reordering ? 1 : 0) + (showExpand ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {searchable ? (
          <form onSubmit={submitSearch} className="relative w-full lg:max-w-xs" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label="Search"
            />
          </form>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2">
          {filters?.length && !reordering ? <DataTableFilters filters={filters} params={params} onChange={setParam} /> : null}
          {toolbar}
          {reorderable && !inTrash ? (
            <Button type="button" variant={reordering ? 'default' : 'outline'} size="sm" onClick={toggleReorder} aria-pressed={reordering}>
              <ArrowUpDown aria-hidden /> {reordering ? 'Done reordering' : 'Reorder'}
            </Button>
          ) : null}
          {!reorderable && reorderDisabledReason && !inTrash ? (
            <span className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled aria-describedby="reorder-disabled-reason">
                <ArrowUpDown aria-hidden /> Reorder
              </Button>
              <span id="reorder-disabled-reason" className="text-xs text-muted-foreground">{reorderDisabledReason}</span>
            </span>
          ) : null}
          {trash ? (
            <Button type="button" variant={inTrash ? 'secondary' : 'outline'} size="sm" onClick={toggleTrash} aria-pressed={inTrash}>
              <Trash2 aria-hidden /> {inTrash ? 'Back to list' : 'Trash'}
            </Button>
          ) : null}
        </div>
      </div>

      {showSelect && selected.size ? (
        <div role="region" aria-label="Actions for selected rows" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          {bulkActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label} type="button" size="sm"
                variant={action.destructive ? 'destructive' : 'outline'}
                onClick={() => action.onSelect(selectedRows, clearSelection)}
              >
                {Icon ? <Icon aria-hidden /> : null} {action.label}
              </Button>
            );
          })}
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Clear selection</Button>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border">
        {/* A refetch dims the table instead of replacing it, so the page never jumps. */}
        <AnimatePresence>
          {isFetching && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/20"
            >
              <div className="animate-indeterminate h-full w-1/3 bg-primary" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={columnCount} />
        ) : !rows.length ? (
          inTrash ? (
            <EmptyState icon={Trash2} title="Trash is empty" description="Deleted records appear here, and can be restored from here." />
          ) : (
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {reordering ? <TableHead className="w-[120px]"><span className="sr-only">Order</span></TableHead> : null}
                {showExpand ? <TableHead className="w-10"><span className="sr-only">Details</span></TableHead> : null}
                {showSelect ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : selectedOnPage ? 'indeterminate' : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all rows on this page"
                    />
                  </TableHead>
                ) : null}
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.className}
                    aria-sort={params.sort === col.key ? 'ascending' : params.sort === `-${col.key}` ? 'descending' : undefined}
                  >
                    {col.sortable && !reordering ? (
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
                {showActions ? <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            {reordering ? (
              <DataTableReorderBody rows={rows} getRowId={getRowId} columns={columns} onMove={move} rowLabel={rowLabel} />
            ) : (
              <TableBody>
                {rows.map((row, i) => {
                  const id = getRowId(row);
                  const isSelected = selected.has(id);
                  const isOpen = showExpand && expanded.has(id);
                  const detailsId = `row-details-${String(id ?? i).replace(/[^\w-]/g, '')}`;
                  return (
                    <Fragment key={id ?? i}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                        onClick={clickable ? () => onRowClick(row) : undefined}
                        data-state={isSelected ? 'selected' : undefined}
                        className={cn(
                          'border-b transition-colors last:border-0 hover:bg-muted/50 data-[state=selected]:bg-muted/60',
                          clickable && 'cursor-pointer',
                        )}
                      >
                        {showExpand ? (
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button" variant="ghost" size="icon" className="h-7 w-7"
                              aria-expanded={isOpen} aria-controls={isOpen ? detailsId : undefined}
                              aria-label={`${isOpen ? 'Hide' : 'Show'} details of ${rowLabel ? rowLabel(row, i) : `row ${i + 1}`}`}
                              onClick={() => toggleExpanded(id)}
                            >
                              <ChevronRight className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} aria-hidden />
                            </Button>
                          </TableCell>
                        ) : null}
                        {showSelect ? (
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(v) => toggleRow(id, v === true)}
                              aria-label={`Select ${rowLabel ? rowLabel(row, i) : `row ${i + 1}`}`}
                            />
                          </TableCell>
                        ) : null}
                        {columns.map((col) => (
                          <TableCell key={col.key} className={col.className}>
                            {col.cell ? col.cell(row) : row[col.key] ?? '—'}
                          </TableCell>
                        ))}
                        {showActions ? (
                          <TableCell className="w-12 text-right">
                            <DataTableRowActions
                              row={row}
                              actions={inTrash ? trashActionsFor(row) : rowActions(row)}
                              label={`Actions for ${rowLabel ? rowLabel(row, i) : `row ${i + 1}`}`}
                            />
                          </TableCell>
                        ) : null}
                      </motion.tr>
                      {isOpen ? (
                        <TableRow id={detailsId} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={columnCount} className="p-0">{expandable.render(row)}</TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            )}
          </Table>
        )}
      </div>

      {total > 0 ? (
        <DataTablePagination
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          pageSizes={reordering ? undefined : pageSizes}
          onPageChange={(p) => onParamsChange?.({ ...params, page: p })}
          onLimitChange={(l) => setParam({ limit: l })}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}
