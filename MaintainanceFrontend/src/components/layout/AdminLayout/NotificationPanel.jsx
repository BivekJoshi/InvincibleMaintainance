import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  useGetNotificationsQuery, useMarkAllReadMutation, useMarkNotificationReadMutation,
} from '@/api/dashboardApi';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { relativeTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { notificationHref } from './notificationLinks';

/**
 * The bell and its panel. The badge polls the unread count every minute; the list
 * itself loads only while the panel is open. Opening a notification marks it read and
 * follows its link inside the app.
 */
export function NotificationPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: badge } = useGetNotificationsQuery({ unreadOnly: 'true' }, { pollingInterval: 60000 });
  const { data, isLoading, error, refetch } = useGetNotificationsQuery({}, { skip: !open });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const unread = data?.unread ?? badge?.unread ?? 0;
  const items = data?.items ?? [];

  const openItem = (item) => {
    if (!item.readAt) markRead(item.id);
    const href = notificationHref(item.link);
    if (href) {
      setOpen(false);
      navigate(href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            type="button" variant="ghost" size="sm" className="h-7 text-xs"
            disabled={!unread} loading={markingAll}
            onClick={() => markAllRead()}
          >
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={refetch} className="py-8" />
        ) : isLoading ? (
          <div className="space-y-3 p-4" aria-hidden>
            <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
          </div>
        ) : !items.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      !item.readAt && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', !item.readAt && 'font-medium')}>
                        {item.title}
                        {!item.readAt ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      {item.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span> : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{relativeTime(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
