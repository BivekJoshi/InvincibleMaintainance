import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ExternalLink, Trash2 } from 'lucide-react';
import {
  useCreateResourceMutation, useDeleteResourceMutation, useGetResourceQuery, useUpdateResourceMutation,
} from '@/api/cmsApi';
import { useResourceEntry } from '@/hooks/useResourceEntry';
import { useConfirm } from '@/hooks/useConfirm';
import { activeCopyOf, screenPathOf } from '@/config/admin/resourceRegistry';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { LocaleTabs } from '@/components/common/LocaleTabs';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { flattenFields } from '@/components/common/ResourceForm/formValues';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * `/admin/content/:resource/new` and `/admin/content/:resource/:id` (or under an entry's
 * own `basePath`) — the create/edit screen of every registry entry: the entry's fields in a
 * `ResourceForm`, inside `LocaleTabs` when it has translatable fields. A new record opens
 * its own edit page once saved, which is where its Nepali tab becomes available.
 *
 * @param {{ resource?: string }} props  set by a fixed route (see `useResourceEntry`)
 */
export default function ResourceEditPage({ resource }) {
  const { status, entry, canWrite } = useResourceEntry(resource);
  if (status === 'unknown') return <NotFoundPage />;
  if (status === 'forbidden') return <Navigate to="/admin" replace />;
  return <ResourceEditor key={entry.resource} entry={entry} canWrite={canWrite} />;
}

function ResourceEditor({ entry, canWrite }) {
  const { resource, label } = entry;
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  // While a delete is on its way the record is shown from a snapshot and its query is stopped: the delete
  // invalidates the record's tag, and a still-subscribed query would refetch a row that now answers 404.
  const [deletedSnapshot, setDeletedSnapshot] = useState(null);
  const query = useGetResourceQuery({ resource, id }, { skip: isNew || Boolean(deletedSnapshot) });
  const record = deletedSnapshot ?? query.data;
  const { isLoading, error, refetch } = query;
  const [create] = useCreateResourceMutation();
  const [update] = useUpdateResourceMutation();
  const [remove, { isLoading: deleting }] = useDeleteResourceMutation();

  const listHref = screenPathOf(entry);
  const readOnlyNew = isNew && !canWrite;
  const translatableFields = useMemo(
    () => flattenFields(entry.fields).filter((f) => entry.translatable?.includes(f.name)),
    [entry],
  );

  const onSubmit = async (body) => {
    if (isNew) {
      const created = await create({ resource, body }).unwrap();
      dispatch(toastSuccess(`${label} created`, entry.translatable?.length ? 'Its Nepali tab is open now.' : undefined));
      navigate(`${listHref}/${created.id}`, { replace: true });
      return;
    }
    await update({ resource, id, body }).unwrap();
    dispatch(toastSuccess(`${label} saved`));
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete this ${label}?`,
      description: `${activeCopyOf(entry).deleteOne} Trash keeps it, and it can be restored from there.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeletedSnapshot(record);
    try {
      await remove({ resource, id }).unwrap();
      dispatch(toastSuccess(`${label} moved to Trash`));
      navigate(listHref);
    } catch (err) {
      setDeletedSnapshot(null);
      dispatch(toastError(`Could not delete this ${label}`, err?.data?.error?.message));
    }
  };

  const publicHref = record ? entry.publicHref?.(record) : null;
  const title = isNew ? `New ${label}` : record ? entry.titleOf(record) : label;

  let body;
  if (readOnlyNew) {
    return <Navigate to={listHref} replace />;
  }
  if (error) {
    body = <ErrorState error={error} onRetry={refetch} />;
  } else if (!isNew && (isLoading || !record)) {
    body = <div className="space-y-4" aria-hidden><Skeleton className="h-9 w-48" /><Skeleton className="h-10" /><Skeleton className="h-32" /></div>;
  } else {
    const form = (
      <ResourceForm
        schema={entry.schema}
        fields={entry.fields}
        defaultValues={isNew ? entry.defaultValues : record}
        onSubmit={onSubmit}
        submitLabel={isNew ? `Create ${label}` : 'Save changes'}
        readOnly={!canWrite}
        onCancel={() => navigate(listHref)}
        className={translatableFields.length ? 'pt-4' : undefined}
      />
    );
    body = translatableFields.length ? (
      <LocaleTabs model={entry.model} recordId={record?.id} fields={translatableFields} sourceValues={record}>
        {form}
      </LocaleTabs>
    ) : form;
  }

  return (
    <PageTransition>
      <PageHeader
        title={title}
        description={isNew ? entry.description : undefined}
        actions={!isNew && record ? (
          <>
            {publicHref ? (
              <Button asChild variant="outline">
                <a href={publicHref} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> View on site</a>
              </Button>
            ) : null}
            {canWrite ? (
              <Button type="button" variant="outline" onClick={onDelete} loading={deleting} className="text-destructive hover:text-destructive">
                <Trash2 aria-hidden /> Delete
              </Button>
            ) : null}
          </>
        ) : null}
      />
      <div className="max-w-3xl rounded-xl border bg-background p-4 sm:p-6">{body}</div>
      {confirmDialog}
    </PageTransition>
  );
}
