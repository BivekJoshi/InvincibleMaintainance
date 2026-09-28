import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ExternalLink, Lock, Trash2 } from 'lucide-react';
import {
  useCreateResourceMutation, useDeleteResourceMutation, useGetResourceQuery, useUpdateResourceMutation,
} from '@/api/cmsApi';
import { useResourceEntry } from '@/hooks/useResourceEntry';
import { useConfirm } from '@/hooks/useConfirm';
import { activeCopyOf, historyCapabilityOf, schemaOf, screenPathOf } from '@/config/admin/resourceRegistry';
import { useAuth } from '@/hooks/useAuth';
import { can as roleCan } from '@/helpers/permissions';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { LocaleTabs } from '@/components/common/LocaleTabs';
import { RecordHistory } from '@/components/common/RecordHistory';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { flattenFields } from '@/components/common/ResourceForm/formValues';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import NotFoundPage from '@/pages/NotFoundPage';

/** An entry without moves of its own: no actions, no dialogs. */
const noRecordActions = () => [() => [], null];

/** Field specs with `lockedOnEdit` fields disabled, groups included. */
const lockFields = (fields) => fields.map((f) => (f.type === 'group'
  ? { ...f, fields: lockFields(f.fields) }
  : f.lockedOnEdit ? { ...f, disabled: true } : f));

/** Field specs without the ones this user may not see (a field's own `capability`), groups included. */
const visibleFields = (fields, can) => fields
  .filter((f) => !f.capability || can(f.capability))
  .map((f) => (f.type === 'group' ? { ...f, fields: visibleFields(f.fields, can) } : f));

/**
 * `/admin/content/:resource/new` and `/admin/content/:resource/:id` (or under an entry's
 * own `basePath`) — the create/edit screen of every registry entry: the entry's fields in a
 * `ResourceForm`, inside `LocaleTabs` when it has translatable fields or tabs of its own. A
 * new record opens its own edit page once saved, which is where its Nepali tab and any
 * other tab (a project's Gallery) become available. A field marked `lockedOnEdit` is
 * read-only once the record exists, and one with a `capability` is shown only to its holders;
 * `intro(record)` shows read-only facts above the form. Every
 * saved record has a History tab (its audit trail) for a role holding the entry's history capability.
 *
 * Phase L7: an entry's `useRecordActions` puts the moves the record's state allows in the header (a purchase list's
 * Mark ordered · Receive · Cancel — a disabled one says why), `readOnlyReason(record)` makes the form read only with
 * the reason above it (a list past its draft), and `deletable(record)` keeps Delete off a record that cannot go.
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
  const { can, role } = useAuth();
  const isNew = !id;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  // The entry is fixed for this component (the page keys it by resource), so the hook is always the same one.
  const useRecordActions = entry.useRecordActions ?? noRecordActions;
  const [recordActionsFor, recordDialogs] = useRecordActions();
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
  const { pageSlugs } = useSiteSettings();
  const pageSlugsKey = pageSlugs.join('/');
  const schema = useMemo(() => schemaOf(entry, { pageSlugs: pageSlugsKey ? pageSlugsKey.split('/') : [] }), [entry, pageSlugsKey]);
  const fields = useMemo(() => {
    const shown = visibleFields(entry.fields, (capability) => roleCan(role, capability));
    return isNew ? shown : lockFields(shown);
  }, [entry, isNew, role]);
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
  const lockReason = !isNew && record ? entry.readOnlyReason?.(record) ?? null : null;
  const moves = !isNew && record && !deletedSnapshot ? recordActionsFor(record) : [];
  const deletable = !record || !entry.deletable || entry.deletable(record);

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
        schema={schema}
        fields={fields}
        intro={!isNew && entry.intro ? entry.intro(record) : undefined}
        defaultValues={isNew ? entry.defaultValues : record}
        onSubmit={onSubmit}
        submitLabel={isNew ? `Create ${label}` : 'Save changes'}
        readOnly={!canWrite || Boolean(lockReason)}
        onCancel={() => navigate(listHref)}
        className={translatableFields.length || entry.tabs?.length ? 'pt-4' : undefined}
      />
    );
    const extraTabs = [
      ...(entry.tabs ?? []).map(({ value, label, component: Tab }) => ({
        value,
        label,
        disabled: isNew,
        content: record ? <Tab record={record} canWrite={canWrite} /> : null,
      })),
      ...(can(historyCapabilityOf(entry)) ? [{
        value: 'history',
        label: 'History',
        disabled: isNew,
        content: record ? <RecordHistory endpoint={`${entry.path}/${record.id}/history`} /> : null,
      }] : []),
    ];
    body = translatableFields.length || extraTabs.length ? (
      <LocaleTabs model={entry.model} recordId={record?.id} fields={translatableFields} sourceValues={record} extraTabs={extraTabs}>
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
            {moves.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.key}
                  type="button"
                  variant={a.primary ? 'default' : 'outline'}
                  disabled={Boolean(a.disabledReason)}
                  title={a.disabledReason}
                  onClick={a.onSelect}
                  className={a.destructive ? 'text-destructive hover:text-destructive' : undefined}
                >
                  {Icon ? <Icon aria-hidden /> : null} {a.label}
                </Button>
              );
            })}
            {canWrite && deletable ? (
              <Button type="button" variant="outline" onClick={onDelete} loading={deleting} className="text-destructive hover:text-destructive">
                <Trash2 aria-hidden /> Delete
              </Button>
            ) : null}
          </>
        ) : null}
      />
      {moves.some((a) => a.disabledReason) ? (
        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
          {moves.filter((a) => a.disabledReason).map((a) => `${a.label}: ${a.disabledReason}`).join(' ')}
        </p>
      ) : null}
      {lockReason ? (
        <p className="mb-3 flex max-w-3xl items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-testid="record-lock">
          <Lock className="h-4 w-4 shrink-0" aria-hidden /> {lockReason}
        </p>
      ) : null}
      <div className="max-w-3xl rounded-xl border bg-background p-4 sm:p-6">{body}</div>
      {recordDialogs}
      {confirmDialog}
    </PageTransition>
  );
}
