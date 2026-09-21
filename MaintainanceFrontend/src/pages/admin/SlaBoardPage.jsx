import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Phone, AlertTriangle, Timer, CheckCircle2, ArrowRight, MessageCircle, RefreshCw, UserPlus, UserX, Loader2,
  Inbox, MessageSquareQuote,
} from 'lucide-react';
import { useAssignLeadMutation, useGetSlaBoardQuery } from '@/api/leadsApi';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { ResponseRunway } from '@/components/leads/ResponseRunway';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { SlaChip } from '@/components/common/SlaChip';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/hooks/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageTransition, Stagger, AnimatePresence } from '@/three/motion/motionKit';
import { ASSIGNABLE_ROLES, SLA_SCOPES, leadsInScope, slaProgress } from '@/helpers/leadBoard';
import { whatsappHref } from '@/helpers/contact';
import { formatDateTime, formatTime, initials, relativeTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/** Each group's colour, as `--tone` for its rail, chips and bar. */
const TONE_VARS = { breach: '--sla-breach', warn: '--sla-warn', ok: '--sla-ok' };
const toneStyle = (tone) => ({ '--tone': `var(${TONE_VARS[tone] ?? '--sla-ok'})` });

/** Stripes on the part of a bar that is past the promise. */
const OVERDUE_STRIPES = 'bg-[repeating-linear-gradient(135deg,hsl(var(--tone))_0_4px,hsl(var(--tone)/0.6)_4px_8px)]';

/** The queue, most urgent first. The runway and the rows read the same three lists. */
const GROUPS = [
  { key: 'breached', title: 'Deadline passed', subtitle: 'Past the two-hour promise — call these first', tone: 'breach', icon: AlertTriangle, empty: 'No breaches. Good.' },
  { key: 'atRisk', title: 'Due soon', subtitle: 'Inside the last 30 minutes', tone: 'warn', icon: Timer, empty: 'Nothing approaching a deadline.' },
  { key: 'waiting', title: 'Waiting', subtitle: 'New enquiries, still on track', tone: 'ok', icon: Inbox, empty: 'No new enquiries waiting.' },
];

/** The clock the rows and the runway read; it ticks with the board's countdowns. */
function useNow(every = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** How much of the window a lead has used; past the deadline it fills and stripes. */
function WindowBar({ lead, now }) {
  const progress = slaProgress(lead, now);
  if (!progress) return null;
  const { ratio, overdueMinutes } = progress;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Response window used"
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', overdueMinutes > 0 ? OVERDUE_STRIPES : 'bg-[hsl(var(--tone))]')}
        style={{ width: `${Math.max(4, ratio * 100)}%` }}
      />
    </div>
  );
}

function QueueRow({ lead, onLog, now, selected }) {
  // The board is route-guarded on leads:read, but logging a response and taking a lead write.
  const { can, role, user } = useAuth();
  const dispatch = useDispatch();
  const [assign, { isLoading: taking }] = useAssignLeadMutation();
  const canWrite = can('leads:write');
  const owner = lead.assignedTo;
  const canTake = canWrite && !owner && ASSIGNABLE_ROLES.includes(role) && Boolean(user?.id);
  const whatsapp = whatsappHref(lead.phone);

  const take = async () => {
    try {
      await assign({ id: lead.id, assignedToId: user.id }).unwrap();
      dispatch(toastSuccess(`${lead.name} is yours`, 'Call them now; logging the call stops the clock.'));
    } catch (err) {
      dispatch(toastError(`Could not take ${lead.name}`, err?.data?.error?.message));
    }
  };

  return (
    <Stagger.Item>
      <article
        id={`sla-lead-${lead.id}`}
        className={cn(
          'group relative grid scroll-mt-24 gap-3 overflow-hidden rounded-xl border bg-card py-3 pl-5 pr-3 shadow-[var(--elevation-1)] transition-[box-shadow,border-color] duration-300',
          'hover:border-[hsl(var(--tone)/0.45)] hover:shadow-[var(--elevation-2)] motion-reduce:transition-none',
          'lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_10rem_23rem] lg:items-center',
          selected && 'border-[hsl(var(--tone))] ring-2 ring-[hsl(var(--tone)/0.35)]',
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--tone))]" />

        {/* Who */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--tone)/0.14)] text-xs font-bold text-[hsl(var(--tone))]"
          >
            {initials(lead.name)}
          </span>
          <div className="min-w-0">
            <Link to={`/admin/leads/${lead.id}`} className="block truncate font-semibold hover:text-primary hover:underline">
              {lead.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {lead.service?.name ?? 'General enquiry'}{lead.area ? ` · ${lead.area}` : ''}
            </p>
          </div>
        </div>

        {/* What they asked for, so the caller knows before dialling — and who has it. */}
        <div className="min-w-0 space-y-1">
          {lead.message ? (
            <p className="flex min-w-0 items-start gap-1.5 text-sm">
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              <span className="line-clamp-1" title={lead.message}>{lead.message}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span title={formatDateTime(lead.createdAt)}>Came in {relativeTime(lead.createdAt)}</span>
            <span aria-hidden>·</span>
            {owner ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">
                  {initials(owner.name)}
                </span>
                {owner.name}
              </span>
            ) : <StateBadge tone="warning"><UserX className="mr-1 h-3 w-3" aria-hidden />Nobody owns this</StateBadge>}
            {lead.preferredLocale === 'ne' ? <StateBadge tone="info"><span lang="ne">नेपाली</span></StateBadge> : null}
          </div>
        </div>

        {/* The clock */}
        <div className="space-y-1.5">
          <SlaChip sla={lead.sla} />
          <WindowBar lead={lead} now={now} />
        </div>

        {/* Act */}
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <Button asChild size="sm" className="rounded-full">
            <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`}><Phone className="h-4 w-4" /> <span className="tabular-nums">{lead.phone}</span></a>
          </Button>
          {whatsapp ? (
            <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-success/40 text-success hover:bg-success/10 hover:text-success">
              <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`}>
                <MessageCircle className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {canTake ? (
            <Button size="sm" variant="outline" className="rounded-full" onClick={take} disabled={taking}>
              {taking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Take it
            </Button>
          ) : null}
          {canWrite ? (
            // Logging the contact is what stops the clock — changing the status is not enough, by design.
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => onLog(lead)}>
              <CheckCircle2 className="h-4 w-4" /> Log response
            </Button>
          ) : null}
          <Button asChild size="icon" variant="ghost" className="h-9 w-9 rounded-full">
            <Link to={`/admin/leads/${lead.id}`} aria-label={`Open ${lead.name}`}>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </Button>
        </div>
      </article>
    </Stagger.Item>
  );
}

function QueueGroup({ group, leads, onLog, now, selectedId }) {
  const { title, subtitle, tone, icon: Icon, empty } = group;
  return (
    <section aria-label={title} style={toneStyle(tone)}>
      <header className="mb-2 flex items-center gap-2.5">
        <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--tone)/0.14)] text-[hsl(var(--tone))]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {tone === 'breach' && leads.length ? (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--tone))] motion-reduce:animate-none" />
          ) : null}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-[hsl(var(--tone)/0.14)] px-2 text-xs font-bold tabular-nums leading-5 text-[hsl(var(--tone))]">{leads.length}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">— {subtitle}</span>
      </header>
      {leads.length ? (
        <Stagger className="space-y-2">
          <AnimatePresence mode="popLayout">
            {leads.map((lead) => <QueueRow key={lead.id} lead={lead} onLog={onLog} now={now} selected={selectedId === lead.id} />)}
          </AnimatePresence>
        </Stagger>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-2.5 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

/**
 * The board that makes the public "2-hour response" promise operational: a runway with every
 * waiting enquiry on its clock, then the queue to clear it, most urgent first. Polls every 30s
 * so a countdown never goes stale on a wall display. The scope (everyone / mine / unassigned)
 * lives in the URL, so a salesperson can bookmark theirs.
 */
export default function SlaBoardPage() {
  const { user } = useAuth();
  const { data, isLoading, isFetching, error, refetch, fulfilledTimeStamp } = useGetSlaBoardQuery(undefined, { pollingInterval: 30000 });
  const [params, setParams] = useListParams({ who: 'all' });
  const [logging, setLogging] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const now = useNow();
  const scope = SLA_SCOPES.some((s) => s.value === params.who) ? params.who : 'all';
  const setScope = (who) => setParams({ ...params, who: who === 'all' ? undefined : who });

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const lists = Object.fromEntries(GROUPS.map((g) => [g.key, leadsInScope(data?.[g.key] ?? [], scope, user?.id)]));
  const everyone = GROUPS.flatMap((g) => data?.[g.key] ?? []);
  const inScope = GROUPS.flatMap((g) => lists[g.key]);
  const unowned = leadsInScope(everyone, 'unassigned').length;

  // A marker on the runway jumps to its row in the queue and lights it for a moment.
  const select = (id) => {
    setSelectedId(id);
    document.getElementById(`sla-lead-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setSelectedId((cur) => (cur === id ? null : cur)), 2400);
  };

  return (
    <PageTransition>
      <PageHeader
        title="Response board"
        description="We promise a reply within two hours. Call the most urgent first; logging the call stops the clock."
        actions={(
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sla-ok/30 bg-sla-ok/10 px-2.5 py-1 text-xs font-medium text-sla-ok">
              <span className="relative flex h-2 w-2">
                <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sla-ok opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sla-ok" />
              </span>
              Live
            </span>
            <Button variant="outline" size="sm" className="rounded-full" onClick={refetch} disabled={isFetching} aria-label="Refresh the board">
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin motion-reduce:animate-none')} />
              {fulfilledTimeStamp ? `Updated ${formatTime(new Date(fulfilledTimeStamp).toISOString())}` : 'Refresh'}
            </Button>
          </div>
        )}
      />

      {isLoading ? (
        <Skeleton className="mb-5 h-40 rounded-2xl" />
      ) : (
        <div className="mb-5">
          <ResponseRunway
            leads={inScope} now={now} onSelect={select}
            met={data?.metToday ?? 0} answered={data?.answeredToday ?? 0} newToday={data?.newToday ?? 0}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single" variant="outline" size="sm" value={scope} aria-label="Whose leads"
          onValueChange={(v) => v && setScope(v)} className="justify-start rounded-full bg-muted/50 p-1"
        >
          {SLA_SCOPES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className="rounded-full border-0 px-4 data-[state=on]:bg-background data-[state=on]:shadow-[var(--elevation-1)]">
              {s.label}
              {s.value === 'unassigned' && unowned ? (
                <span aria-hidden className="ml-1.5 rounded-full bg-warning/15 px-1.5 text-[10px] font-bold tabular-nums text-warning">{unowned}</span>
              ) : null}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {inScope.length
            ? `${inScope.length} waiting for a first reply${unowned ? ` · ${unowned} with nobody on them` : ''} · refreshes every 30 seconds`
            : 'Nobody waiting here · refreshes every 30 seconds'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <QueueGroup key={g.key} group={g} leads={lists[g.key]} onLog={setLogging} now={now} selectedId={selectedId} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(logging)} onOpenChange={(o) => { if (!o) setLogging(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log the response to {logging?.name}</DialogTitle>
            <DialogDescription>A call, SMS, WhatsApp message, email or visit stops the response clock.</DialogDescription>
          </DialogHeader>
          {/* The toast carries the result ("Responded in 34 min…"); the board drops the lead once it is answered. */}
          {logging ? <ActivityComposer lead={logging} onLogged={() => setLogging(null)} /> : null}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
