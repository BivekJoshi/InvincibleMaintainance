import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AlertTriangle, LockOpen } from 'lucide-react';
import { useGetLoginActivityQuery, useGetLoginSummaryQuery } from '@/api/auditApi';
import { useUnlockUserMutation } from '@/api/usersApi';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { AuditRowDetails } from '@/components/platform/AuditRowDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/three/motion/motionKit';
import { AUDIT_EVENT_LABELS, AUTH_EVENT_NAMES } from '@/config/auditEvents';
import { formatDateTime, relativeTime, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const EVENT_TONES = {
  'auth.login': 'success',
  'auth.login_failed': 'warning',
  'auth.locked': 'warning',
  'auth.unlocked': 'info',
  'auth.sessions_revoked': 'info',
};

const REASONS = {
  wrong_password: 'Wrong password',
  unknown_email: 'No account with this email',
  locked: 'Account was locked',
  disabled: 'Account is switched off',
};

const columns = [
  {
    key: 'createdAt', header: 'When', sortable: true, className: 'whitespace-nowrap',
    cell: (r) => <time dateTime={r.createdAt} className="tabular-nums">{formatDateTime(r.createdAt)}</time>,
  },
  {
    key: 'event', header: 'What',
    cell: (r) => <StateBadge tone={EVENT_TONES[r.event] ?? 'muted'}>{AUDIT_EVENT_LABELS[r.event] ?? r.event}</StateBadge>,
  },
  {
    key: 'user', header: 'Account',
    cell: (r) => (r.user ? (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{r.user.email} · {titleCase(r.user.role)}</p>
      </div>
    ) : (
      <div className="min-w-0">
        <p className="truncate font-mono text-xs">{r.email ?? '—'}</p>
        <p className="text-xs text-muted-foreground">No such account</p>
      </div>
    )),
  },
  {
    key: 'reason', header: 'Detail', className: 'min-w-[150px]',
    cell: (r) => {
      const words = [REASONS[r.reason] ?? r.reason, r.attempt ? `attempt ${r.attempt}` : null].filter(Boolean).join(' · ');
      return words || <span className="text-muted-foreground">—</span>;
    },
  },
  { key: 'ip', header: 'IP address', cell: (r) => <span className="font-mono text-xs">{r.ip ?? '—'}</span> },
  {
    key: 'userAgent', header: 'Browser',
    cell: (r) => <span className="block max-w-[160px] truncate text-xs text-muted-foreground" title={r.userAgent ?? undefined}>{r.userAgent ?? '—'}</span>,
  },
];

const filters = [
  {
    key: 'userId', label: 'Account', type: 'relation',
    relation: { path: '/admin/users', labelKey: (u) => `${u.name} · ${titleCase(u.role)}` },
  },
  { key: 'event', label: 'Event', type: 'enum', allLabel: 'Every sign-in event', options: AUTH_EVENT_NAMES.map((e) => ({ value: e, label: AUDIT_EVENT_LABELS[e] })) },
  { key: 'ip', label: 'IP address', type: 'text' },
  { key: 'created', label: 'Date', type: 'dateRange' },
];

/** Accounts locked now, or with failed sign-ins in the last day — each with Unlock. */
function NeedsAttention({ onShow }) {
  const dispatch = useDispatch();
  const { data } = useGetLoginSummaryQuery({ attention: true, limit: 20 });
  const [unlock] = useUnlockUserMutation();
  const rows = data?.items ?? [];
  if (!rows.length) return null;

  const onUnlock = async (row) => {
    try {
      await unlock(row.user.id).unwrap();
      dispatch(toastSuccess(`${row.user.name} can try again now`));
    } catch (err) {
      dispatch(toastError('Could not unlock this account', err?.data?.error?.message));
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y" aria-label="Accounts that need attention">
          {rows.map((row) => (
            <li key={row.user.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
              <button type="button" className="min-w-0 text-left hover:underline" onClick={() => onShow(row.user.id)}>
                <span className="font-medium">{row.user.name}</span>
                <span className="text-muted-foreground"> · {row.user.email}</span>
              </button>
              <span className="text-muted-foreground">
                {row.failures24h} failed in 24 h · last sign-in {row.lastLoginAt ? relativeTime(row.lastLoginAt) : 'never'}
              </span>
              {row.isLocked ? (
                <span className="ml-auto flex items-center gap-2">
                  <StateBadge tone="warning">Locked until {formatDateTime(row.lockedUntil)}</StateBadge>
                  <Button type="button" size="sm" variant="outline" onClick={() => onUnlock(row)}>
                    <LockOpen aria-hidden /> Unlock {row.user.name}
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * `/admin/platform/login-activity` (ADMIN) — every sign-in, failure, lock and unlock, with
 * the address and browser, and the accounts that need a look now.
 */
export default function LoginActivityPage() {
  const [params, setParams] = useListParams({ limit: 50, sort: '-createdAt' });
  const { data, isLoading, isFetching, error, refetch } = useGetLoginActivityQuery(params);
  const navigate = useNavigate();

  return (
    <PageTransition>
      <PageHeader
        title="Login activity"
        description="Sign-ins, failures and lockouts. Five failures in a row lock an account for 15 minutes."
      />
      <NeedsAttention onShow={(userId) => setParams({ ...params, userId, page: 1 })} />
      <CustomTable
        storageKey="login-activity"
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
        searchPlaceholder="Name or email, including a mistyped one…"
        expandable={{
          render: (row) => (
            <AuditRowDetails
              row={{ ...row, model: 'User', recordId: row.user?.id ?? null }}
              onRequest={(requestId) => navigate(`/admin/platform/audit?requestId=${encodeURIComponent(requestId)}&sort=createdAt`)}
            />
          ),
        }}
        rowLabel={(r) => `${AUDIT_EVENT_LABELS[r.event]}, ${r.user?.name ?? r.email ?? ''}, ${formatDateTime(r.createdAt)}`}
        emptyTitle="No sign-in activity matches"
        emptyDescription="Try a wider date range, or clear a filter."
        pageSizes={[20, 50, 100]}
      />
    </PageTransition>
  );
}
