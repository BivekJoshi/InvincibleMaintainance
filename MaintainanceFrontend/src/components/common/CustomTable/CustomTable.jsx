import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ArrowUpDown, ChevronRight, Inbox, RotateCcw, Search, Trash2,
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
import { CustomTableCell, cellsOf } from './CustomTableCell';
import { CustomTableFilters } from './CustomTableFilters';
import { CustomTableHead } from './CustomTableHead';
import { CustomTablePagination } from './CustomTablePagination';
import { CustomTableReorderBody } from './CustomTableReorderBody';
import { CustomTableRowActions } from './CustomTableRowActions';
import { CustomTableViewOptions } from './CustomTableViewOptions';
import { downloadCsv } from './exportCsv';
import { useCustomTableLayout } from './useCustomTableLayout';

const PAGE_SIZES = [10, 20, 50, 100];
const NO_ROWS = [];
const rowIdOf = (row) => row.id;

/** `?sort=-name` ↔ TanStack's `[{ id: 'name', desc: true }]`. */
const sortingFromParam = (sort) => (sort ? [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }] : []);
const sortingToParam = (sorting) => (sorting[0] ? `${sorting[0].desc ? '-' : ''}${sorting[0].id}` : undefined);

/** A column's name in menus and the CSV header — its header when that is text. */
const columnLabel = (col) => col.label ?? (typeof col.header === 'string' ? col.header : col.key);

/** Our `{ key, header, cell(row) }` column shape → a TanStack column def. */
const toColumnDef = (col) => ({
  id: col.key,
  accessorFn: (row) => row[col.key],
  header: col.header,
  cell: ({ row, getValue }) => (col.cell ? col.cell(row.original) : getValue() ?? '—'),
  enableSorting: Boolean(col.sortable),
  enableHiding: col.hideable !== false,
  ...(col.size ? { size: col.size } : null),
  meta: { className: col.className, label: columnLabel(col), exportValue: col.exportValue },
});

/** A column the table adds around the caller's: fixed width, never hidden, sorted, moved or resized. */
const displayColumn = (id, size, def) => ({
  id, size, enableSorting: false, enableHiding: false, enablePinning: false, ...def,
  meta: { display: true, ...def.meta },
});

const isDisplayId = (id) => id.startsWith('_');
const LEADING_DISPLAY = ['_expand', '_select', '_number'];

/**
 * The one table in this app, on TanStack Table (headless) with shadcn/ui cells — the
 * Material React Table feature set without MUI. Server-side pagination, sorting, search
 * and filters: the API speaks `?page&limit&sort&q`, this component drives those params
 * and `useListParams` keeps them in the URL. TanStack holds the rest of the state.
 *
 * Data features (opt-in):
 * - `rowActions(row)`  → a kebab menu per row, pinned to the right edge.
 * - `bulkActions`      → a checkbox column, select-all-on-page and a bar of actions for the
 *                        selection. Selection clears when the page or filters change.
 * - `filters`          → the filter bar (enum, relation, dateRange, boolean, text).
 * - `trash`            → a Trash toggle (`?deleted=true`) whose rows offer Restore, and
 *                        Delete forever to anyone with `cms:purge`.
 * - `reorderable`      → a Reorder mode: drag handles plus Move up / Move down. The new
 *                        order shows at once; if `onReorder` rejects, it snaps back.
 * - `expandable`       → a detail panel per row: `render(row)` beneath it, across the table.
 * - `enableRowNumbers` → a # column, counted across pages.
 * - `exportable`       → Export the page (or the selection) as CSV — what the cells show, or a
 *                        column's `exportValue(row)` when it has one.
 *
 * Layout features (on by default for a full list — searchable, more than four columns):
 * `enableColumnActions` (the per-column menu), `enableColumnPinning`, `enableColumnOrdering`,
 * `enableColumnResizing`, `enableHiding` (the Columns menu), `enableDensityToggle`,
 * `enableFullScreenToggle`. A column opts out of hiding with `hideable: false`, starts hidden
 * with `hidden: true`, and sets a starting width with `size`. With `storageKey` the viewer's
 * layout (hidden, ordered, pinned and resized columns, density) is remembered in this browser.
 * `maxHeight` scrolls the body under a sticky header, as full screen does.
 *
 * @param {object} props
 * @param {{ key: string, header: import('react').ReactNode, label?: string, sortable?: boolean,
 *   hideable?: boolean, hidden?: boolean, size?: number, className?: string,
 *   cell?: (row: object) => any, exportValue?: (row: object) => unknown }[]} props.columns
 * @param {object[]|undefined} props.data  the rows of the current page (the API's `data` array)
 * @param {{ page: number, limit: number, total: number, pages: number }} [props.meta]
 * @param {object} [props.params]          current list params, from `useListParams`
 * @param {(params: object) => void} props.onParamsChange
 * @param {(row: object) => void} [props.onRowClick]
 * @param {(row: object) => string} [props.getRowId]
 * @param {(row: object) => object[]} [props.rowActions] see `CustomTableRowActions`
 * @param {{ label: string, icon?: import('react').ElementType, destructive?: boolean,
 *   onSelect: (rows: object[], clearSelection: () => void) => void }[]} [props.bulkActions]
 * @param {number[]} [props.pageSizes]
 * @param {object[]} [props.filters] see `CustomTableFilters`
 * @param {{ onRestore: (row: object) => void, onPurge?: (row: object) => void, canPurge?: boolean }} [props.trash]
 * @param {boolean} [props.reorderable]
 * @param {string} [props.reorderDisabledReason] when set and the table is not reorderable, a disabled
 *   Reorder button says why (list items reorder one group at a time)
 * @param {(items: { id: string, sortOrder: number }[]) => Promise<unknown>|void} [props.onReorder]
 *   the new order of this page, offset by the rows on earlier pages — the body `PATCH /reorder` takes
 * @param {(row: object, index: number) => string} [props.rowLabel] names a row for screen readers
 * @param {boolean} [props.searchable] false hides the search box (a short list that is already complete)
 * @param {{ render: (row: object) => import('react').ReactNode }} [props.expandable]
 * @param {string} [props.storageKey] remembers the viewer's layout per table in this browser
 * @param {boolean} [props.exportable]
 * @param {string} [props.exportName] the CSV's file name, before the date (default `storageKey` or "export")
 * @param {string|number} [props.maxHeight] e.g. `'70vh'`: the body scrolls under a sticky header
 */
export function CustomTable({
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
  storageKey,
  exportable = false,
  exportName,
  maxHeight,
  enableRowNumbers = false,
  enableColumnActions,
  enableColumnPinning,
  enableColumnOrdering,
  enableColumnResizing,
  enableHiding,
  enableDensityToggle,
  enableFullScreenToggle,
}) {
  const { can } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState(params.q ?? '');
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState({});
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  const tableRef = useRef(null);
  const {
    layout, isDefault: layoutIsDefault, resetLayout,
    setColumnVisibility, setColumnOrder, setColumnSizing, setColumnPinning, setDensity,
  } = useCustomTableLayout(storageKey, columns);

  // A full list gets the whole layout toolkit unless the caller says otherwise.
  const fullList = searchable && columns.length > 4;
  const features = {
    actions: enableColumnActions ?? fullList,
    pinning: enableColumnPinning ?? fullList,
    ordering: enableColumnOrdering ?? fullList,
    resizing: enableColumnResizing ?? fullList,
    hiding: enableHiding ?? fullList,
    density: enableDensityToggle ?? fullList,
    fullScreen: enableFullScreenToggle ?? fullList,
  };

  // The URL is the source of truth: Back, a shared link or "Clear filters" all change q without typing.
  useEffect(() => { setSearch(params.q ?? ''); }, [params.q]);

  // A new page of rows replaces any optimistic order, and drops selections that are no longer on screen.
  useEffect(() => {
    setOrder(null);
    setRowSelection((prev) => {
      const ids = Object.keys(prev);
      if (!ids.length) return prev;
      const onPage = new Set((data ?? []).map((row) => String(getRowId(row))));
      const kept = ids.filter((id) => onPage.has(id));
      return kept.length === ids.length ? prev : Object.fromEntries(kept.map((id) => [id, true]));
    });
  }, [data, getRowId]);

  // Reorder mode ends if the table stops being reorderable (a required filter went away).
  useEffect(() => { if (!reorderable) setReordering(false); }, [reorderable]);

  const paramsKey = JSON.stringify(params);
  useEffect(() => { setRowSelection({}); setExpanded({}); }, [paramsKey]);

  // Full screen owns the viewport: the page behind it does not scroll.
  useEffect(() => {
    if (!fullScreen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [fullScreen]);

  const inTrash = params.deleted === 'true' || params.deleted === true;
  const rows = order ?? data ?? NO_ROWS;
  const nameOf = (row, i) => (rowLabel ? rowLabel(row, i) : `row ${i + 1}`);
  const page = meta?.page ?? 1;
  const pages = meta?.pages ?? 1;
  const total = meta?.total ?? 0;
  const limit = meta?.limit ?? params.limit ?? 20;

  const setParam = (patch) => onParamsChange?.({ ...params, page: 1, ...patch });

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

  const showSelect = Boolean(bulkActions?.length) && !inTrash && !reordering;
  const showActions = !reordering && (inTrash ? Boolean(trash) : Boolean(rowActions));
  const showExpand = Boolean(expandable) && !reordering;
  const showNumbers = enableRowNumbers && !reordering;
  const clickable = Boolean(onRowClick) && !inTrash;
  const stickyHeader = fullScreen || maxHeight != null;

  // Display columns (expand, select, #, actions) wrap the caller's data columns.
  const columnDefs = [
    ...(showExpand ? [displayColumn('_expand', 44, {
      header: () => <span className="sr-only">Details</span>,
      cell: ({ row }) => {
        const isOpen = row.getIsExpanded();
        return (
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            aria-expanded={isOpen} aria-controls={isOpen ? detailsIdOf(row) : undefined}
            aria-label={`${isOpen ? 'Hide' : 'Show'} details of ${nameOf(row.original, row.index)}`}
            onClick={() => row.toggleExpanded()}
          >
            <ChevronRight className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} aria-hidden />
          </Button>
        );
      },
      meta: { className: 'px-2', stopPropagation: true },
    })] : []),
    ...(showSelect ? [displayColumn('_select', 44, {
      header: ({ table: t }) => (
        <Checkbox
          checked={t.getIsAllPageRowsSelected() ? true : t.getIsSomePageRowsSelected() ? 'indeterminate' : false}
          onCheckedChange={(v) => t.toggleAllPageRowsSelected(v === true)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v === true)}
          aria-label={`Select ${nameOf(row.original, row.index)}`}
        />
      ),
      meta: { className: 'px-3', stopPropagation: true },
    })] : []),
    ...(showNumbers ? [displayColumn('_number', 56, {
      header: '#',
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{(page - 1) * limit + row.index + 1}</span>,
      meta: { className: 'px-3 text-right' },
    })] : []),
    ...columns.map(toColumnDef),
    ...(showActions ? [displayColumn('_actions', 56, {
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <CustomTableRowActions
          row={row.original}
          actions={inTrash ? trashActionsFor(row.original) : rowActions(row.original)}
          label={`Actions for ${nameOf(row.original, row.index)}`}
        />
      ),
      meta: { className: 'px-2 text-right' },
    })] : []),
  ];

  const dataIds = columns.map((c) => c.key);
  const dataIdsKey = dataIds.join(' ');
  // The display columns always sit on the edges; the viewer's pins go inside them.
  const columnPinning = useMemo(() => {
    const valid = new Set(dataIdsKey.split(' '));
    return {
      left: [...LEADING_DISPLAY, ...layout.columnPinning.left.filter((id) => valid.has(id))],
      right: [...layout.columnPinning.right.filter((id) => valid.has(id)), '_actions'],
    };
  }, [layout.columnPinning, dataIdsKey]);

  const sorting = useMemo(() => sortingFromParam(params.sort), [params.sort]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getRowId: (row) => String(getRowId(row)),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
    sortDescFirst: false,
    enableColumnPinning: true,
    getRowCanExpand: () => showExpand,
    state: {
      sorting,
      rowSelection,
      expanded,
      columnVisibility: layout.columnVisibility,
      columnOrder: layout.columnOrder,
      columnSizing: layout.columnSizing,
      columnPinning,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onParamsChange?.({ ...params, sort: sortingToParam(next) });
    },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnPinning) : updater;
      setColumnPinning({
        left: (next.left ?? []).filter((id) => !isDisplayId(id)),
        right: (next.right ?? []).filter((id) => !isDisplayId(id)),
      });
    },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => table.resetRowSelection(true);

  // Move a column one place among the visible, unpinned ones.
  const movableIds = table.getCenterVisibleLeafColumns().map((c) => c.id).filter((id) => !isDisplayId(id));
  const moveColumn = (id, step) => {
    const i = movableIds.indexOf(id);
    const neighbour = movableIds[i + step];
    if (i < 0 || !neighbour) return;
    const current = [...layout.columnOrder.filter((c) => dataIds.includes(c)), ...dataIds.filter((c) => !layout.columnOrder.includes(c))];
    const a = current.indexOf(id);
    const b = current.indexOf(neighbour);
    [current[a], current[b]] = [current[b], current[a]];
    setColumnOrder(current);
  };

  // Export what the viewer sees: each visible data column's cell text, unless it has an `exportValue`.
  const exportRows = (selectedOnly) => {
    const exported = headers.map((h) => h.column).filter((c) => !isDisplayId(c.id));
    const bodyRows = [...(tableRef.current?.querySelectorAll('tbody > tr[data-row-id]') ?? [])];
    const textById = new Map(bodyRows.map((tr) => [tr.dataset.rowId, Object.fromEntries(
      [...tr.children].map((td) => [td.dataset.columnId, td.textContent.replace(/\s+/g, ' ').trim()]),
    )]));
    const lines = table.getRowModel().rows
      .filter((row) => !selectedOnly || row.getIsSelected())
      .map((row) => exported.map((c) => {
        const { exportValue } = c.columnDef.meta ?? {};
        return exportValue ? exportValue(row.original) : textById.get(row.id)?.[c.id] ?? '';
      }));
    downloadCsv(exportName ?? storageKey ?? 'export', [exported.map((c) => c.columnDef.meta?.label || c.id), ...lines]);
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
    clearSelection();
    // The manual order only means something in the list's own order, not sorted by a column.
    if (!reordering && params.sort) onParamsChange?.({ ...params, sort: undefined });
    setReordering((r) => !r);
  };

  const move = async (from, to) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const previous = rows;
    const next = arrayMove(rows, from, to);
    setOrder(next);
    const offset = (page - 1) * (meta?.limit ?? params.limit ?? next.length);
    try {
      await onReorder?.(next.map((row, i) => ({ id: getRowId(row), sortOrder: offset + i })));
    } catch {
      setOrder(previous);
    }
  };

  // Escape leaves full screen — unless it is closing a menu or dialog opened from inside the table.
  const onKeyDown = (e) => {
    if (!fullScreen || e.key !== 'Escape') return;
    const layer = e.target.closest?.('[role="menu"], [role="dialog"], [role="listbox"]');
    if (!layer || layer === e.currentTarget) setFullScreen(false);
  };

  const headers = [...table.getLeftLeafHeaders(), ...table.getCenterLeafHeaders(), ...table.getRightLeafHeaders()];
  const columnCount = headers.length + (reordering ? 1 : 0);

  return (
    <div
      onKeyDown={onKeyDown}
      role={fullScreen ? 'dialog' : undefined}
      aria-modal={fullScreen || undefined}
      aria-label={fullScreen ? 'Table, full screen' : undefined}
      className={cn(
        fullScreen ? 'fixed inset-0 z-50 flex flex-col gap-4 bg-background p-4 sm:p-6' : 'space-y-4',
      )}
    >
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
          {filters?.length && !reordering ? <CustomTableFilters filters={filters} params={params} onChange={setParam} /> : null}
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
          <CustomTableViewOptions
            table={table}
            enabled={{ ...features, exportable: exportable && !reordering && rows.length > 0 }}
            density={layout.density}
            onDensityChange={setDensity}
            fullScreen={fullScreen}
            onFullScreenChange={setFullScreen}
            onExport={exportRows}
            selectedCount={showSelect ? selectedRows.length : 0}
            layoutIsDefault={layoutIsDefault}
            onResetLayout={resetLayout}
          />
        </div>
      </div>

      {showSelect && selectedRows.length ? (
        <div role="region" aria-label="Actions for selected rows" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selectedRows.length} selected</span>
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

      <div className={cn('relative overflow-hidden rounded-xl border', fullScreen && 'min-h-0 flex-1')}>
        {/* A refetch dims the table instead of replacing it, so the page never jumps. */}
        <AnimatePresence>
          {isFetching && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-primary/20"
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
          <Table
            ref={tableRef}
            containerClassName={cn(stickyHeader && 'overflow-y-auto', fullScreen && 'h-full')}
            containerStyle={!fullScreen && maxHeight != null ? { maxHeight } : undefined}
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {reordering ? (
                  <TableHead className={cn('w-[120px] bg-background shadow-[inset_0_0_0_9999px_hsl(var(--muted)/0.4)]', stickyHeader && 'sticky top-0 z-20')}>
                    <span className="sr-only">Order</span>
                  </TableHead>
                ) : null}
                {headers.map((header) => (
                  <CustomTableHead
                    key={header.id}
                    header={header}
                    reordering={reordering}
                    stickyHeader={stickyHeader}
                    features={features}
                    onMove={moveColumn}
                    canMove={{
                      left: movableIds.indexOf(header.column.id) > 0,
                      right: movableIds.indexOf(header.column.id) < movableIds.length - 1,
                    }}
                  />
                ))}
              </TableRow>
            </TableHeader>
            {reordering ? (
              <CustomTableReorderBody rows={table.getRowModel().rows} onMove={move} rowLabel={nameOf} density={layout.density} />
            ) : (
              <TableBody>
                {table.getRowModel().rows.map((row, i) => (
                  <Fragment key={row.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                      onClick={clickable ? () => onRowClick(row.original) : undefined}
                      data-row-id={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={cn(
                        'group border-b transition-colors last:border-0 hover:bg-muted/50 data-[state=selected]:bg-muted/60',
                        clickable && 'cursor-pointer',
                      )}
                    >
                      {cellsOf(row).map((cell) => <CustomTableCell key={cell.id} cell={cell} density={layout.density} />)}
                    </motion.tr>
                    {row.getIsExpanded() ? (
                      <TableRow id={detailsIdOf(row)} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={columnCount} className="p-0">{expandable.render(row.original)}</TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            )}
          </Table>
        )}
      </div>

      {total > 0 ? (
        <CustomTablePagination
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

const detailsIdOf = (row) => `row-details-${row.id.replace(/[^\w-]/g, '')}`;
