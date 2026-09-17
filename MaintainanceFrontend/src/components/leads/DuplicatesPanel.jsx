import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Merge } from 'lucide-react';
import { useGetLeadDuplicatesQuery, useMergeLeadsMutation } from '@/api/leadsApi';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { useConfirm } from '@/hooks/useConfirm';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDateTime } from '@/helpers/format';
import { mergePreview } from '@/helpers/leadDisplay';

const columns = [
  {
    key: 'name', header: 'Lead',
    cell: (r) => (
      <Link to={`/admin/leads/${r.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.name}</Link>
    ),
  },
  { key: 'matchedOn', header: 'Same', cell: (r) => (r.matchedOn === 'email' ? r.email : r.phone) },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  { key: 'createdAt', header: 'Received', cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span> },
];

/**
 * Other leads with this phone or email. Merging folds the picked ones into this lead:
 * their notes, timeline, quotations and jobs move here and they close as LOST.
 * A WON duplicate cannot be merged away (the API refuses) — open it and merge from there.
 *
 * @param {{ lead: object, canWrite: boolean }} props
 */
export function DuplicatesPanel({ lead, canWrite }) {
  const dispatch = useDispatch();
  const { data, isLoading, isFetching, error, refetch } = useGetLeadDuplicatesQuery(lead.id);
  const [merge] = useMergeLeadsMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [params, setParams] = useState({});

  const onMerge = async (rows, clear) => {
    const moving = mergePreview(rows);
    const ok = await confirm({
      title: `Merge ${rows.length} lead${rows.length === 1 ? '' : 's'} into ${lead.name}?`,
      description: `${moving ? `Moves ${moving} into this lead.` : 'There are no notes, quotations or jobs to move.'} `
        + `${rows.map((r) => r.name).join(', ')} will be closed as lost and removed from the lists. This cannot be undone.`,
      confirmLabel: 'Merge',
      destructive: true,
    });
    if (!ok) return;
    try {
      await merge({ primaryId: lead.id, duplicateIds: rows.map((r) => r.id) }).unwrap();
      dispatch(toastSuccess('Merged', `${rows.length} duplicate${rows.length === 1 ? '' : 's'} folded into ${lead.name}.`));
      clear();
    } catch (err) {
      dispatch(toastError('Could not merge', err?.data?.error?.message));
    }
  };

  const rows = data ?? [];
  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        meta={{ page: 1, pages: 1, limit: rows.length || 1, total: rows.length }}
        params={params}
        onParamsChange={setParams}
        searchable={false}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        pageSizes={[]}
        rowLabel={(r) => r.name}
        bulkActions={canWrite ? [{ label: 'Merge into this lead', icon: Merge, destructive: true, onSelect: onMerge }] : undefined}
        emptyTitle="No duplicates"
        emptyDescription="No other lead has this phone number or email."
      />
      {confirmDialog}
    </>
  );
}
