import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ExternalLink, Eye, EyeOff, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useDeleteResourceMutation, useListResourceQuery, useReorderResourceMutation,
  useRestoreResourceMutation, useToggleResourceMutation,
} from '@/api/cmsApi';
import { useResourceEntry } from '@/hooks/useResourceEntry';
import { useListParams } from '@/hooks/useListParams';
import { useConfirm } from '@/hooks/useConfirm';
import { activeCopyOf, screenPathOf } from '@/config/admin/resourceRegistry';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import NotFoundPage from '@/pages/NotFoundPage';

/** The API's message for a failed call, for the toast's second line. */
const messageOf = (err) => err?.data?.error?.message;

/**
 * `/admin/content/:resource` (or an entry's own `basePath`) — the list screen of every
 * registry entry. The entry supplies columns, filters and copy; this page adds what every
 * CMS list has: the on/off switch, Edit / View on site / Hide / Delete, bulk delete,
 * Reorder, and Trash.
 *
 * @param {{ resource?: string }} props  set by a fixed route (see `useResourceEntry`)
 */
export default function ResourceListPage({ resource }) {
  const { status, entry, canWrite } = useResourceEntry(resource);
  if (status === 'unknown') return <NotFoundPage />;
  if (status === 'forbidden') return <Navigate to="/admin" replace />;
  // Keyed, so moving between two resources never carries one's state into the other.
  return <ResourceList key={entry.resource} entry={entry} canWrite={canWrite} />;
}

function ResourceList({ entry, canWrite }) {
  const { resource, label } = entry;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [params, setParams] = useListParams({ limit: 20 });
  const { data, isLoading, isFetching, error, refetch } = useListResourceQuery({ resource, params });
  const [toggle] = useToggleResourceMutation();
  const [reorder] = useReorderResourceMutation();
  const [remove] = useDeleteResourceMutation();
  const [restore] = useRestoreResourceMutation();

  const inTrash = params.deleted === 'true';
  const screenPath = screenPathOf(entry);
  const copy = activeCopyOf(entry);
  const editHref = (row) => `${screenPath}/${row.id}`;
  const nameOf = (row) => entry.titleOf(row);

  const onToggle = async (row) => {
    try {
      const updated = await toggle({ resource, id: row.id }).unwrap();
      dispatch(toastSuccess(`${label} ${updated.isActive ? copy.turnedOn : copy.turnedOff}`));
    } catch (err) {
      dispatch(toastError(`Could not change this ${label}`, messageOf(err)));
    }
  };

  const onDelete = async (rows, clearSelection) => {
    const one = rows.length === 1;
    const ok = await confirm({
      title: one ? `Delete this ${label}?` : `Delete ${rows.length} ${entry.labelPlural}?`,
      description: `${one ? copy.deleteOne : copy.deleteMany} Trash keeps ${one ? 'it' : 'them'}, and ${one ? 'it' : 'they'} can be restored from there.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const results = await Promise.allSettled(rows.map((row) => remove({ resource, id: row.id }).unwrap()));
    const failed = results.filter((r) => r.status === 'rejected');
    clearSelection?.();
    if (failed.length) dispatch(toastError(`${failed.length} could not be deleted`, messageOf(failed[0].reason)));
    else dispatch(toastSuccess(one ? `${label} moved to Trash` : `${rows.length} ${entry.labelPlural} moved to Trash`));
  };

  const onRestore = async (row) => {
    try {
      await restore({ resource, id: row.id }).unwrap();
      dispatch(toastSuccess(`${label} restored`, 'It is back in the list, switched on or off as it was.'));
    } catch (err) {
      dispatch(toastError(`Could not restore this ${label}`, messageOf(err)));
    }
  };

  const onPurge = async (row) => {
    try {
      await remove({ resource, id: row.id, hard: true }).unwrap();
      dispatch(toastSuccess(`${label} deleted for good`));
    } catch (err) {
      dispatch(toastError(`Could not delete this ${label}`, messageOf(err)));
    }
  };

  const onReorder = (items) => reorder({ resource, items }).unwrap().catch((err) => {
    dispatch(toastError('The new order was not saved', messageOf(err)));
    throw err;
  });

  const activeColumn = {
    key: 'isActive',
    header: copy.column,
    sortable: true,
    className: 'w-20',
    cell: (row) => (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
        <Switch
          checked={Boolean(row.isActive)}
          disabled={!canWrite || inTrash}
          onCheckedChange={() => onToggle(row)}
          aria-label={`${copy.switchLabel} “${nameOf(row)}”`}
        />
      </span>
    ),
  };

  const rowActions = (row) => {
    const href = entry.publicHref?.(row);
    return [
      { label: 'Edit', icon: Pencil, onSelect: () => navigate(editHref(row)) },
      ...(href ? [{ label: 'View on site', icon: ExternalLink, onSelect: () => window.open(href, '_blank', 'noopener') }] : []),
      ...(canWrite ? [
        row.isActive
          ? { label: copy.turnOff, icon: EyeOff, onSelect: () => onToggle(row) }
          : { label: copy.turnOn, icon: Eye, onSelect: () => onToggle(row) },
        { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => onDelete([row]) },
      ] : []),
    ];
  };

  return (
    <PageTransition>
      <PageHeader
        title={entry.labelPlural}
        description={entry.description}
        actions={canWrite ? (
          <Button asChild>
            <Link to={`${screenPath}/new`}><Plus aria-hidden /> New {label}</Link>
          </Button>
        ) : null}
      />
      {entry.notice ? (
        <p className="mb-4 flex max-w-3xl gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{entry.notice}</span>
        </p>
      ) : null}
      <DataTable
        columns={[...entry.columns, activeColumn]}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={(row) => navigate(editHref(row))}
        rowLabel={nameOf}
        searchPlaceholder={entry.searchPlaceholder}
        emptyTitle={entry.emptyTitle}
        emptyDescription={entry.emptyDescription}
        filters={entry.filters}
        rowActions={rowActions}
        bulkActions={canWrite ? [{ label: 'Delete', icon: Trash2, destructive: true, onSelect: onDelete }] : undefined}
        trash={canWrite ? { onRestore, onPurge } : undefined}
        reorderable={Boolean(entry.sortable) && canWrite}
        onReorder={onReorder}
      />
      {confirmDialog}
    </PageTransition>
  );
}
