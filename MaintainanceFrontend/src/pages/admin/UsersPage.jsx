import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  History, KeyRound, Lock, LockOpen, MonitorSmartphone, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX,
} from 'lucide-react';
import {
  useDeleteUserMutation, useGetUserQuery, useGetUsersQuery, useSendPasswordResetMutation, useToggleUserMutation,
  useUnlockUserMutation,
} from '@/api/usersApi';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { StateBadge } from '@/components/common/StateBadge';
import { UserFormSheet } from '@/components/platform/UserFormSheet';
import { SessionsDialog } from '@/components/platform/SessionsDialog';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/three/motion/motionKit';
import { ROLES } from '@/config/constants';
import { formatDateTime, relativeTime, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const messageOf = (err) => err?.data?.error?.message;

const columns = [
  {
    key: 'name', header: 'Name', sortable: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.name}</p>
        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
      </div>
    ),
  },
  { key: 'role', header: 'Role', sortable: true, cell: (r) => titleCase(r.role) },
  {
    key: 'isActive', header: 'Status',
    cell: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.isActive ? <StateBadge tone="success">Active</StateBadge> : <StateBadge>Disabled</StateBadge>}
        {r.isLocked ? (
          <StateBadge tone="warning" title={`Locked until ${formatDateTime(r.lockedUntil)}`}>
            <Lock className="mr-1 h-3 w-3" aria-hidden />Locked
          </StateBadge>
        ) : null}
      </div>
    ),
  },
  {
    key: 'lastLoginAt', header: 'Last sign-in', sortable: true, className: 'whitespace-nowrap',
    cell: (r) => (r.lastLoginAt
      ? <time dateTime={r.lastLoginAt} title={formatDateTime(r.lastLoginAt)}>{relativeTime(r.lastLoginAt)}</time>
      : <span className="text-muted-foreground">Never</span>),
  },
  { key: 'phone', header: 'Phone', cell: (r) => r.phone ?? <span className="text-muted-foreground">—</span> },
];

const filters = [
  { key: 'role', label: 'Role', type: 'enum', allLabel: 'Every role', options: ROLES.map((r) => ({ value: r, label: titleCase(r) })) },
  { key: 'isActive', label: 'Status', type: 'boolean', trueLabel: 'Active', falseLabel: 'Disabled', allLabel: 'Active or not' },
];

/**
 * `/admin/platform/users` (ADMIN) — who can sign in, and as what. New people get an email to
 * choose a password; from a row an admin edits, switches off, sends a reset link, lifts a
 * lock, or signs someone out everywhere. An admin cannot switch themselves off.
 * `?open=<id>` opens that person's sheet (the audit log links here).
 */
export default function UsersPage() {
  const [params, setParams] = useListParams({ limit: 20, sort: 'name' });
  const { data, isLoading, isFetching, error, refetch } = useGetUsersQuery(params);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user: me } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sessionsOf, setSessionsOf] = useState(null);
  const [toggle] = useToggleUserMutation();
  const [remove] = useDeleteUserMutation();
  const [sendReset] = useSendPasswordResetMutation();
  const [unlock] = useUnlockUserMutation();

  // A link to one person (`?open=`) opens their sheet once the record is here.
  const openId = params.open;
  const { data: linked } = useGetUserQuery(openId, { skip: !openId || Boolean(editing) });
  const sheetUser = editing ?? (openId ? linked : null);
  const closeSheet = () => {
    setEditing(null);
    if (openId) setParams({ ...params, open: undefined });
  };

  const isMe = (row) => row.id === me?.id;

  const run = async (promise, done, failed) => {
    try {
      const result = await promise;
      dispatch(toastSuccess(...[].concat(typeof done === 'function' ? done(result) : done)));
    } catch (err) {
      dispatch(toastError(failed, messageOf(err)));
    }
  };

  const onToggle = async (row) => {
    if (row.isActive) {
      const ok = await confirm({
        title: `Switch off ${row.name}?`,
        description: 'They are signed out everywhere and cannot sign in until the account is switched on again.',
        confirmLabel: 'Switch off',
        destructive: true,
      });
      if (!ok) return;
    }
    await run(toggle(row.id).unwrap(), (u) => (u.isActive ? `${row.name} can sign in again` : `${row.name} is switched off`), 'Could not change this account');
  };

  const onReset = async (row) => {
    const ok = await confirm({
      title: `Email ${row.name} a reset link?`,
      description: `A link to choose a new password goes to ${row.email}. It works once, for an hour. You never see it.`,
      confirmLabel: 'Send link',
    });
    if (!ok) return;
    await run(sendReset(row.id).unwrap(), (r) => ['Reset link sent', `Sent to ${r.email}.`], 'Could not send the link');
  };

  const onUnlock = (row) => run(unlock(row.id).unwrap(), `${row.name} can try again now`, 'Could not unlock this account');

  const onDelete = async (row) => {
    const ok = await confirm({
      title: `Remove ${row.name}?`,
      description: 'The account can no longer sign in and leaves this list. Its history stays in the audit log.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await run(remove(row.id).unwrap(), `${row.name} removed`, 'Could not remove this account');
  };

  const rowActions = (row) => {
    const self = isMe(row);
    return [
      { label: 'Edit', icon: Pencil, onSelect: () => setEditing(row) },
      { label: 'Sessions', icon: MonitorSmartphone, onSelect: () => setSessionsOf(row) },
      { label: 'Send reset link', icon: KeyRound, disabled: !row.isActive, onSelect: () => onReset(row) },
      ...(row.isLocked ? [{ label: 'Unlock', icon: LockOpen, onSelect: () => onUnlock(row) }] : []),
      { label: 'Activity', icon: History, onSelect: () => navigate(`/admin/platform/audit?model=User&recordId=${row.id}`) },
      { separator: true },
      row.isActive
        ? { label: self ? 'Switch off (not your own)' : 'Switch off', icon: UserX, disabled: self, onSelect: () => onToggle(row) }
        : { label: 'Switch on', icon: UserCheck, onSelect: () => onToggle(row) },
      { label: self ? 'Remove (not your own)' : 'Remove', icon: Trash2, destructive: true, disabled: self, onSelect: () => onDelete(row) },
    ];
  };

  return (
    <PageTransition>
      <PageHeader
        title="Users"
        description="Staff accounts: who can sign in, and what they can do."
        actions={(
          <>
            <Button asChild variant="outline"><Link to="/admin/platform/roles"><ShieldCheck aria-hidden /> Roles & permissions</Link></Button>
            <Button onClick={() => setCreating(true)}><Plus aria-hidden /> New user</Button>
          </>
        )}
      />
      <CustomTable
        storageKey="users"
        columns={columns}
        data={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        refetch={refetch}
        params={params}
        onParamsChange={setParams}
        onRowClick={setEditing}
        rowActions={rowActions}
        rowLabel={(r) => r.name}
        filters={filters}
        searchPlaceholder="Search name, email or phone…"
        emptyTitle="No users match"
        emptyDescription="Clear a filter, or add someone with New user."
      />
      <UserFormSheet open={creating} onOpenChange={setCreating} />
      {sheetUser ? (
        <UserFormSheet
          key={sheetUser.id}
          user={sheetUser}
          self={isMe(sheetUser)}
          open
          onOpenChange={(next) => { if (!next) closeSheet(); }}
        />
      ) : null}
      <SessionsDialog user={sessionsOf} onOpenChange={(next) => { if (!next) setSessionsOf(null); }} />
      {confirmDialog}
    </PageTransition>
  );
}
