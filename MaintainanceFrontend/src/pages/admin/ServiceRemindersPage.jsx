import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Mail, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteServiceReminderMutation, useGetServiceRemindersQuery } from '@/api/aftercareApi';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { ReminderFormSheet } from '@/components/aftercare/ReminderFormSheet';
import { ViewTabs } from '@/components/aftercare/ViewTabs';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { REMINDER_VIEWS, selectView, viewQuery } from '@/config/admin/aftercareViews';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';
import { REMINDER_CHANNEL_LABELS } from '@/config/constants';
import { reminderLock } from '@/helpers/aftercare';
import { formatDateTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/** Devanagari in a message: the cell gets the Nepali face and `lang`. */
const isNepali = (text) => /[ऀ-ॿ]/.test(text ?? '');

const columns = [
  {
    key: 'dueAt', header: 'Goes out', sortable: true,
    cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.dueAt)}</span>,
    exportValue: (r) => formatDateTime(r.dueAt),
  },
  {
    key: 'customer', header: 'Customer',
    cell: (r) => (
      <div className="min-w-0 max-w-[200px]">
        <p className="truncate">{r.customer?.name}</p>
        {r.customer?.phone ? (
          <a href={`tel:${r.customer.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {r.customer.phone}
          </a>
        ) : null}
      </div>
    ),
    exportValue: (r) => r.customer?.name ?? '',
  },
  {
    key: 'channel', header: 'By',
    cell: (r) => {
      const Icon = r.channel === 'email' ? Mail : MessageSquare;
      return <span className="inline-flex items-center gap-1 text-xs"><Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {REMINDER_CHANNEL_LABELS[r.channel] ?? r.channel}</span>;
    },
    exportValue: (r) => REMINDER_CHANNEL_LABELS[r.channel] ?? r.channel,
  },
  {
    key: 'message', header: 'Message',
    cell: (r) => (
      <p lang={isNepali(r.message) ? 'ne' : undefined} className="line-clamp-2 max-w-md text-sm">{r.message}</p>
    ),
    exportValue: (r) => r.message,
  },
  {
    key: 'status', header: 'Status', sortable: true,
    cell: (r) => (
      <div className="space-y-0.5">
        <AftercareStatus kind="reminder" status={r.status} />
        {r.sentAt ? <p className="whitespace-nowrap text-[11px] text-muted-foreground">{formatDateTime(r.sentAt)}</p> : null}
        {r.status === 'failed' || r.status === 'skipped' ? <p className="max-w-[180px] text-[11px] text-muted-foreground">{reminderLock(r)}</p> : null}
      </div>
    ),
    exportValue: (r) => r.status,
  },
];

/**
 * Service reminders (Phase I, I9): the messages that go out on their day — tabs Pending · Sent · Failed ·
 * Skipped · All, a customer and a date filter. `reminders:write` adds one and, while it is still pending, edits
 * or deletes it; once it went out (or failed, or was skipped) it is the customer's history and both are
 * disabled with the reason.
 */
export default function ServiceRemindersPage() {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('reminders:write');
  const [params, setParams] = useListParams({ limit: 20 });
  const { view, query } = viewQuery(REMINDER_VIEWS, params, 'pending');
  const { data, isLoading, isFetching, error, refetch } = useGetServiceRemindersQuery({
    ...query, sort: query.sort ?? (view === 'pending' ? 'dueAt' : '-dueAt'),
  });
  const [remove] = useDeleteServiceReminderMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [sheet, setSheet] = useState(null); // { reminder? }

  const onDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete this reminder?',
      description: `${row.customer?.name ?? 'The customer'} will not get it on ${formatDateTime(row.dueAt)}.`,
      confirmLabel: 'Delete reminder',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      dispatch(toastSuccess('Reminder deleted'));
    } catch (err) {
      dispatch(toastError('Could not delete the reminder', err?.data?.error?.message));
    }
  };

  // Edit and Delete stay in the menu, disabled, once the reminder went out: the row says why.
  const rowActions = (row) => {
    if (!canWrite) return [];
    const lock = reminderLock(row);
    return [
      { label: 'Edit', icon: Pencil, disabled: Boolean(lock), onSelect: () => setSheet({ reminder: row }) },
      { label: 'Delete', icon: Trash2, destructive: true, disabled: Boolean(lock), onSelect: () => onDelete(row) },
    ];
  };

  return (
    <PageTransition>
      <PageHeader
        title="Service reminders"
        description="Messages that bring customers back — sent on their day, by SMS or email."
        actions={canWrite ? <Button size="sm" onClick={() => setSheet({})}><Plus aria-hidden /> New reminder</Button> : null}
      />
      <ViewTabs views={REMINDER_VIEWS} value={view} label="Reminder status" onChange={(next) => setParams(selectView(params, next))} />
      <CustomTable
        storageKey="service-reminders"
        exportable
        exportName="service-reminders"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={canWrite ? (row) => { if (!reminderLock(row)) setSheet({ reminder: row }); } : undefined}
        rowLabel={(r) => `Reminder to ${r.customer?.name ?? 'a customer'} on ${formatDateTime(r.dueAt)}`}
        rowActions={canWrite ? rowActions : undefined}
        filters={[
          { key: 'customerId', label: 'Customer', type: 'relation', relation: CUSTOMER_RELATION },
          { key: 'due', label: 'Goes out', type: 'dateRange' },
        ]}
        searchPlaceholder="Search message, customer or phone…"
        emptyTitle={view === 'pending' ? 'Nothing waiting to go out' : 'No reminders here'}
        emptyDescription="A completed job adds a check-up reminder for about eleven months later."
      />
      {canWrite && sheet ? (
        <ReminderFormSheet open onOpenChange={(o) => { if (!o) setSheet(null); }} reminder={sheet.reminder ?? null} />
      ) : null}
      {confirmDialog}
    </PageTransition>
  );
}
