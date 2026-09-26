import { useDispatch } from 'react-redux';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useGetUserSessionsQuery, useRevokeUserSessionsMutation } from '@/api/usersApi';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useConfirm } from '@/hooks/useConfirm';
import { formatDateTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const CLIENT_LABELS = { WEB: 'Web browser', DESKTOP: 'Desktop app' };

/**
 * Where someone is signed in (one row per session: the app, when it started and was last used,
 * when it lapses, the address and the browser) and "Sign out everywhere". A session ended here cannot be renewed; a screen already
 * open keeps working for at most 15 minutes unless the account is switched off.
 *
 * @param {{ user: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function SessionsDialog({ user, onOpenChange }) {
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const open = Boolean(user);
  const { data: sessions, isLoading, error, refetch } = useGetUserSessionsQuery(user?.id, { skip: !open });
  const [revoke, { isLoading: revoking }] = useRevokeUserSessionsMutation();

  const revokeAll = async () => {
    const ok = await confirm({
      title: `Sign ${user.name} out everywhere?`,
      description: 'Every device has to sign in again. A page already open stops working within 15 minutes.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    });
    if (!ok) return;
    try {
      const { revoked } = await revoke(user.id).unwrap();
      dispatch(toastSuccess(revoked === 1 ? '1 session ended' : `${revoked} sessions ended`));
    } catch (err) {
      dispatch(toastError('Could not end the sessions', err?.data?.error?.message));
    }
  };

  let body;
  if (error) body = <ErrorState error={error} onRetry={refetch} />;
  else if (isLoading) body = <div className="space-y-2" aria-busy="true"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  else if (!sessions?.length) body = <EmptyState icon={MonitorSmartphone} title="Not signed in anywhere" description="Sessions appear here when they sign in." className="py-8" />;
  else {
    body = (
      <ul className="divide-y rounded-lg border" aria-label="Sessions">
        {sessions.map((s) => (
          <li key={s.id} className="space-y-0.5 px-3 py-2 text-sm">
            <p className="font-medium">
              {CLIENT_LABELS[s.client] ?? CLIENT_LABELS.WEB} · signed in {formatDateTime(s.signedInAt ?? s.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.ip ?? 'Unknown address'} · last active {formatDateTime(s.createdAt)} · expires {formatDateTime(s.expiresAt)}
            </p>
            {s.userAgent ? <p className="break-all text-xs text-muted-foreground">{s.userAgent}</p> : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? `${user.name}’s sessions` : 'Sessions'}</DialogTitle>
          <DialogDescription>Each place this account is signed in, newest first.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">{body}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" variant="destructive" onClick={revokeAll} loading={revoking} disabled={!sessions?.length}>
            <LogOut aria-hidden /> Sign out everywhere
          </Button>
        </DialogFooter>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
