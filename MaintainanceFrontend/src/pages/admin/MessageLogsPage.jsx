import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Mail, MessageSquare, RotateCw } from 'lucide-react';
import { useGetMessageLogsQuery, useRetryMessageMutation } from '@/api/messagesApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { PageTransition } from '@/three/motion/motionKit';
import { MESSAGE_CHANNELS, MESSAGE_STATUSES } from '@/config/constants';
import { recordHref } from '@/helpers/recordLinks';
import { formatDateTime, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const STATUS = {
  queued: { tone: 'info', label: 'Sending' },
  sent: { tone: 'success', label: 'Sent' },
  failed: { tone: 'warning', label: 'Failed' },
};
const CHANNEL_LABELS = { sms: 'SMS', email: 'Email' };

/** The kinds of record a message can be about — the related-record filter. */
const RELATED_MODELS = ['Lead', 'Customer', 'Quotation', 'Job', 'Invoice', 'Warranty', 'User'];

/** A redacted one-time link reads as what it is. */
const REDACTED = '[redacted]';

function DeliveryDetails({ row }) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2">
        {row.subject ? <p className="text-sm font-medium">{row.subject}</p> : null}
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-background p-3 font-sans text-sm" lang={/[ऀ-ॿ]/.test(row.body) ? 'ne' : undefined}>
          {row.body}
        </pre>
        {row.body.includes(REDACTED) ? (
          <p className="text-xs text-muted-foreground">A one-time link is never kept; it cannot be read back or sent again from here.</p>
        ) : null}
      </div>
      <dl className="space-y-1.5 text-xs">
        {[
          ['Provider', row.provider],
          ['Provider reference', row.providerId],
          ['Error', row.error],
          ['Record', row.relatedModel ? `${row.relatedModel} · ${row.relatedId}` : null],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all font-mono">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const filters = [
  { key: 'channel', label: 'Channel', type: 'enum', allLabel: 'SMS and email', options: MESSAGE_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] })) },
  { key: 'status', label: 'Status', type: 'enum', allLabel: 'Every status', options: MESSAGE_STATUSES.map((s) => ({ value: s, label: STATUS[s].label })) },
  { key: 'templateKey', label: 'Template key', type: 'text', placeholder: 'quotation_sent' },
  { key: 'relatedModel', label: 'About', type: 'enum', allLabel: 'Any record', options: RELATED_MODELS.map((m) => ({ value: m, label: titleCase(m) })) },
  { key: 'relatedId', label: 'Record id', type: 'text' },
  { key: 'created', label: 'Date', type: 'dateRange' },
];

/**
 * `/admin/platform/messages` (ADMIN) — every SMS and email the system sent or tried to: its
 * state, the provider's error, the record it was about, and Send again for a failure.
 * Addresses show their last digits only.
 */
export default function MessageLogsPage() {
  const [params, setParams] = useListParams({ limit: 50, sort: '-createdAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetMessageLogsQuery(params);
  const [retry] = useRetryMessageMutation();
  const dispatch = useDispatch();

  const onRetry = async (row) => {
    try {
      const result = await retry(row.id).unwrap();
      if (result.status === 'sent') dispatch(toastSuccess('Sent', `Delivered to ${result.toAddress} this time.`));
      else dispatch(toastError('It failed again', result.error));
    } catch (err) {
      dispatch(toastError('Could not send it again', err?.data?.error?.message));
    }
  };

  const columns = [
    {
      key: 'createdAt', header: 'When', sortable: true, className: 'whitespace-nowrap',
      cell: (r) => <time dateTime={r.createdAt} className="tabular-nums">{formatDateTime(r.createdAt)}</time>,
    },
    {
      key: 'channel', header: 'To',
      cell: (r) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          {r.channel === 'sms'
            ? <MessageSquare className="h-4 w-4 text-muted-foreground" aria-label="SMS" />
            : <Mail className="h-4 w-4 text-muted-foreground" aria-label="Email" />}
          <span className="font-mono text-xs">{r.toAddress}</span>
        </span>
      ),
    },
    { key: 'templateKey', header: 'Template', cell: (r) => <span className="font-mono text-xs">{r.templateKey ?? '—'}</span> },
    {
      key: 'status', header: 'Status',
      cell: (r) => (
        <div className="min-w-0">
          <StateBadge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</StateBadge>
          {r.error ? <p className="mt-0.5 max-w-[260px] truncate text-xs text-destructive" title={r.error}>{r.error}</p> : null}
        </div>
      ),
    },
    {
      key: 'related', header: 'About',
      cell: (r) => {
        if (!r.relatedModel) return <span className="text-muted-foreground">—</span>;
        const href = recordHref({ model: r.relatedModel, recordId: r.relatedId });
        return href
          ? <Link to={href} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{titleCase(r.relatedModel)}</Link>
          : <span>{titleCase(r.relatedModel)}</span>;
      },
    },
  ];

  const rowActions = (row) => (row.status === 'failed'
    ? [{
      label: row.body.includes(REDACTED) ? 'Send again (one-time link — send a new one)' : 'Send again',
      icon: RotateCw,
      disabled: row.body.includes(REDACTED),
      onSelect: () => onRetry(row),
    }]
    : []);

  return (
    <PageTransition>
      <PageHeader
        title="Messages"
        description="Every SMS and email: whether it went, and why not when it did not."
      />
      <CustomTable
        storageKey="message-logs"
        exportable
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        filters={filters}
        rowActions={rowActions}
        expandable={{ render: (row) => <DeliveryDetails row={row} /> }}
        rowLabel={(r) => `${CHANNEL_LABELS[r.channel]} to ${r.toAddress}, ${formatDateTime(r.createdAt)}`}
        searchPlaceholder="Part of a number or address…"
        emptyTitle="No messages match"
        emptyDescription="Try a wider date range, or clear a filter."
        pageSizes={[20, 50, 100]}
      />
    </PageTransition>
  );
}
