import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Phone, AlertTriangle, Timer, CheckCircle2, ArrowRight, MessageCircle, RefreshCw, UserPlus, UserX, Loader2,
  Inbox, MessageSquareQuote, PartyPopper, Siren, Sparkles,
} from 'lucide-react';
import { useAssignLeadMutation, useGetSlaBoardQuery } from '@/api/leadsApi';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { SlaChip } from '@/components/common/SlaChip';
import { StateBadge } from '@/components/common/StateBadge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/hooks/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageTransition, Stagger, AnimatePresence } from '@/three/motion/motionKit';
import { ASSIGNABLE_ROLES, SLA_SCOPES, leadsInScope, slaProgress } from '@/helpers/leadBoard';
import { whatsappHref } from '@/helpers/contact';
import { formatDateTime, formatTime, initials } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

/** Each column's colour, as `--tone` for its header, cards and bars. */
const TONE_VARS = { breach: '--sla-breach', warn: '--sla-warn' };
const toneStyle = (tone) => ({ '--tone': `var(${TONE_VARS[tone] ?? '--sla-ok'})` });

/** Stripes on the part of a bar that is past the promise. */
const OVERDUE_STRIPES = 'bg-[repeating-linear-gradient(135deg,hsl(var(--tone))_0_6px,hsl(var(--tone)/0.7)_6px_12px)]';

/** The clock the cards' bars read; it ticks with the board's countdowns. */
function useNow(every = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** How much of the two-hour window a lead has used, as a bar; past the deadline it fills and stripes. */
function WindowBar({ lead, now }) {
  const progress = slaProgress(lead, now);
  if (!progress) return null;
  const { ratio, overdueMinutes } = progress;
  const overdue = overdueMinutes > 0;
  const words = overdue
    ? `${overdueMinutes >= 60 ? `${Math.floor(overdueMinutes / 60)} h ${overdueMinutes % 60} min` : `${overdueMinutes} min`} past the promise`
    : `${Math.round(ratio * 100)}% of the window used`;
  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn('font-medium', overdue ? 'text-[hsl(var(--tone))]' : 'text-muted-foreground')}>{words}</span>
        <span className="text-muted-foreground">2 h promise</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Response window used"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', overdue ? OVERDUE_STRIPES : 'bg-[hsl(var(--tone))]')}
          style={{ width: `${Math.max(4, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

function LeadCard({ lead, onLog, now }) {
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
        className={cn(
          'group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-[var(--elevation-1)] transition-[box-shadow,border-color] duration-200',
          'hover:border-[hsl(var(--tone)/0.45)] hover:shadow-[var(--elevation-2)] motion-reduce:transition-none',
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[hsl(var(--tone))]" />
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--tone)/0.14)] text-sm font-bold text-[hsl(var(--tone))] ring-2 ring-[hsl(var(--tone)/0.25)]"
          >
            {initials(lead.name)}
          </span>
          <div className="min-w-0 flex-1">
            <Link to={`/admin/leads/${lead.id}`} className="font-semibold hover:text-primary hover:underline">
              {lead.name}
            </Link>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {lead.service?.name ?? 'General enquiry'} · {lead.area ?? lead.address ?? '—'}
            </p>
          </div>
          <SlaChip sla={lead.sla} />
        </div>

        <WindowBar lead={lead} now={now} />

        {/* What they asked for, so the caller knows before dialling. */}
        {lead.message ? (
          <div className="relative mt-3 rounded-xl bg-muted/60 py-2 pl-8 pr-3 text-sm">
            <MessageSquareQuote className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" aria-hidden />
            <p className="line-clamp-2" title={lead.message}>{lead.message}</p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Received {formatDateTime(lead.createdAt)}</span>
          <span aria-hidden>·</span>
          {owner ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                {initials(owner.name)}
              </span>
              Owner {owner.name}
            </span>
          ) : <StateBadge tone="warning"><UserX className="mr-1 h-3 w-3" aria-hidden />Nobody owns this</StateBadge>}
          {lead.preferredLocale === 'ne' ? <StateBadge tone="info"><span lang="ne">नेपाली</span></StateBadge> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dotted pt-3">
          <Button asChild size="sm" className="rounded-full">
            <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> {lead.phone}</a>
          </Button>
          {whatsapp ? (
            <Button asChild size="sm" variant="outline" className="rounded-full border-success/40 text-success hover:bg-success/10 hover:text-success">
              <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
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
          <Button asChild size="sm" variant="ghost" className="ml-auto rounded-full">
            <Link to={`/admin/leads/${lead.id}`} aria-label={`Open ${lead.name}`}>Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></Link>
          </Button>
        </div>
      </article>
    </Stagger.Item>
  );
}

function Column({ title, subtitle, icon: Icon, tone, leads, emptyText, onLog, now }) {
  return (
    <section aria-label={title} style={toneStyle(tone)} className="overflow-hidden rounded-3xl border bg-[hsl(var(--tone)/0.04)]">
      <header className="flex items-center gap-3 border-b border-dotted bg-gradient-to-r from-[hsl(var(--tone)/0.16)] to-transparent px-4 py-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--tone))] text-primary-foreground shadow-[var(--elevation-1)]">
          <Icon className="h-4 w-4" aria-hidden />
          {tone === 'breach' && leads.length ? (
            <span aria-hidden className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-[hsl(var(--tone))] motion-reduce:animate-none" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--tone)/0.15)] px-2.5 py-0.5 text-sm font-bold tabular-nums text-[hsl(var(--tone))]">{leads.length}</span>
      </header>
      <div className="p-3">
        {leads.length ? (
          <Stagger className="space-y-3">
            <AnimatePresence mode="popLayout">
              {leads.map((lead) => <LeadCard key={lead.id} lead={lead} onLog={onLog} now={now} />)}
            </AnimatePresence>
          </Stagger>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dotted py-10 text-center text-sm text-muted-foreground">
            <PartyPopper className="h-6 w-6 text-sla-ok" aria-hidden />
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

/** Today's score as a ring: the share of answered enquiries that were answered in time. */
function PromiseRing({ met, answered, newToday }) {
  const share = answered ? met / answered : null;
  const r = 52;
  const length = 2 * Math.PI * r;
  const stroke = share == null ? 'stroke-muted-foreground/30' : share >= 0.9 ? 'stroke-sla-ok' : share >= 0.7 ? 'stroke-sla-warn' : 'stroke-sla-breach';
  return (
    <div className="flex items-center gap-4 rounded-3xl border bg-gradient-to-br from-sla-ok/10 via-card to-card p-4 shadow-[var(--elevation-1)]">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={r} className="fill-none stroke-muted" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r} strokeWidth="10" strokeLinecap="round"
            className={cn('fill-none transition-[stroke-dashoffset] duration-1000 motion-reduce:transition-none', stroke)}
            strokeDasharray={length} strokeDashoffset={length * (1 - (share ?? 0))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{share == null ? '—' : `${Math.round(share * 100)}%`}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">on time</span>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today’s promise</p>
        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums">{answered ? `${met} of ${answered}` : '—'}</span>
          <span className="block text-muted-foreground">answered in time</span>
        </p>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden /> {newToday} new enquir{newToday === 1 ? 'y' : 'ies'} today
        </p>
      </div>
    </div>
  );
}

/** One number at the top of the board. A tile with `onClick` narrows the board to what it counts. */
function Tile({ label, value, hint, tone, icon: Icon, onClick, pressed }) {
  const lit = Boolean(value) && tone;
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            lit ? 'bg-[hsl(var(--tone)/0.15)] text-[hsl(var(--tone))]' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {lit && tone === 'breach' ? (
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--tone))] motion-reduce:animate-none" />
        ) : null}
      </div>
      <p className={cn('mt-3 text-3xl font-bold leading-none tabular-nums', lit && 'text-[hsl(var(--tone))]')}>{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </>
  );
  const shell = cn(
    'relative overflow-hidden rounded-2xl border bg-card p-3.5 text-left shadow-[var(--elevation-1)]',
    lit && 'border-[hsl(var(--tone)/0.35)] bg-gradient-to-br from-[hsl(var(--tone)/0.08)] to-card',
    pressed && 'ring-2 ring-primary',
  );
  return onClick ? (
    <button
      type="button" onClick={onClick} aria-pressed={pressed} style={toneStyle(tone)}
      className={cn(shell, 'transition-shadow hover:shadow-[var(--elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
    >
      {body}
    </button>
  ) : <div style={toneStyle(tone)} className={shell}>{body}</div>;
}

/**
 * The board that makes the public "2-hour response" promise operational.
 * Polls every 30s so a countdown never goes stale on a wall display. The scope
 * (everyone / mine / unassigned) lives in the URL, so a salesperson can bookmark theirs.
 */
export default function SlaBoardPage() {
  const { user } = useAuth();
  const { data, isLoading, isFetching, error, refetch, fulfilledTimeStamp } = useGetSlaBoardQuery(undefined, { pollingInterval: 30000 });
  const [params, setParams] = useListParams({ who: 'all' });
  const [logging, setLogging] = useState(null);
  const now = useNow();
  const scope = SLA_SCOPES.some((s) => s.value === params.who) ? params.who : 'all';
  const setScope = (who) => setParams({ ...params, who: who === 'all' ? undefined : who });

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const allBreached = data?.breached ?? [];
  const allAtRisk = data?.atRisk ?? [];
  const breached = leadsInScope(allBreached, scope, user?.id);
  const atRisk = leadsInScope(allAtRisk, scope, user?.id);
  const unowned = leadsInScope([...allBreached, ...allAtRisk], 'unassigned').length;
  const answered = data?.answeredToday ?? 0;
  const met = data?.metToday ?? 0;
  const clear = !isLoading && !breached.length && !atRisk.length;

  return (
    <PageTransition>
      <PageHeader
        title="Response board"
        description="We promise a two-hour response. Call the oldest first; logging the call stops the clock."
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

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <PromiseRing met={met} answered={answered} newToday={data?.newToday ?? 0} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tile label="Deadline passed" value={allBreached.length} tone="breach" icon={Siren} hint="Call these first" />
          <Tile label="Due soon" value={allAtRisk.length} tone="warn" icon={Timer} hint="Inside the last stretch" />
          <Tile
            label="Nobody owns" value={unowned} tone={unowned ? 'warn' : undefined} icon={Inbox}
            hint={unowned ? 'Show only these' : 'Every waiting lead has an owner'}
            onClick={unowned || scope === 'unassigned' ? () => setScope(scope === 'unassigned' ? 'all' : 'unassigned') : undefined}
            pressed={scope === 'unassigned'}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single" variant="outline" size="sm" value={scope} aria-label="Whose leads"
          onValueChange={(v) => v && setScope(v)} className="justify-start rounded-full bg-muted/50 p-1"
        >
          {SLA_SCOPES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className="rounded-full border-0 px-4 data-[state=on]:bg-background data-[state=on]:shadow-[var(--elevation-1)]">
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">Oldest first. Refreshes every 30 seconds.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : clear ? (
        <EmptyState
          icon={CheckCircle2}
          title={scope === 'all' ? 'Every enquiry has been answered in time' : 'Nothing waiting here'}
          description={scope === 'all'
            ? 'Nothing is breached and nothing is approaching its deadline. This board refreshes every 30 seconds.'
            : 'None of these leads is breached or close to its deadline. Switch to Everyone to see the whole board.'}
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Column
            title="Deadline passed" icon={AlertTriangle} tone="breach" leads={breached}
            subtitle="Past the two-hour promise" emptyText="No breaches. Good." onLog={setLogging} now={now}
          />
          <Column
            title="Due soon" icon={Timer} tone="warn" leads={atRisk}
            subtitle="Call before the clock runs out" emptyText="Nothing approaching a deadline." onLog={setLogging} now={now}
          />
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
