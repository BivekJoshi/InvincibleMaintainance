import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useGetNotificationsQuery, useMarkNotificationReadMutation } from '@/api/dashboardApi';
import { ChartCard } from '@/components/charts/ChartCard';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationHref } from '@/components/layout/AdminLayout/notificationLinks';
import { SHELL_POLL_MS } from '@/config/constants';
import { relativeTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The newest things addressed to you — the bell's list, kept open on the dashboard. */
export function LatestCard({ limit = 6, className }) {
  const navigate = useNavigate();
  const { data, isLoading } = useGetNotificationsQuery({}, { pollingInterval: SHELL_POLL_MS });
  const [markRead] = useMarkNotificationReadMutation();
  const items = Array.isArray(data?.items) ? data.items.slice(0, limit) : [];

  const open = (item) => {
    if (!item.readAt) markRead(item.id);
    const href = notificationHref(item.link);
    if (href) navigate(href);
  };

  return (
    <ChartCard
      title="Latest for you"
      subtitle={data?.unread ? `${data.unread} unread` : 'You’re all caught up'}
      icon={Bell}
      className={className}
    >
      {isLoading ? (
        <div className="space-y-2" aria-hidden>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : items.length ? (
        <ul className="-mx-1 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', item.readAt ? 'bg-border' : 'bg-primary')} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-xs', !item.readAt && 'font-semibold')}>
                    {item.title}
                    {!item.readAt ? <span className="sr-only"> (unread)</span> : null}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {relativeTime(item.createdAt)}{item.body ? ` · ${item.body}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="grid flex-1 place-items-center py-6 text-center text-sm text-muted-foreground">Nothing new.</p>
      )}
    </ChartCard>
  );
}
