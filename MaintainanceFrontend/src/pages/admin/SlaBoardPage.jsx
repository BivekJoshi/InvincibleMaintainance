import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Phone, AlertTriangle, Timer, CheckCircle2, ArrowRight, MessageCircle, RefreshCw, UserPlus, UserX, Loader2,
} from 'lucide-react';
import { useAssignLeadMutation, useGetSlaBoardQuery } from '@/api/leadsApi';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { SlaChip } from '@/components/common/SlaChip';
import { StateBadge } from '@/components/common/StateBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/hooks/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageTransition, Stagger, AnimatePresence } from '@/three/motion/motionKit';
import { ASSIGNABLE_ROLES, SLA_SCOPES, leadsInScope } from '@/helpers/leadBoard';
import { whatsappHref } from '@/helpers/contact';
import { formatDateTime, formatTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

function LeadCard({ lead, tone, onLog }) {
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
      <Card className={cn('border-l-4', tone === 'breach' ? 'border-l-destructive' : 'border-l-sla-warn')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/admin/leads/${lead.id}`} className="font-semibold hover:underline">
                {lead.name}
              </Link>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {lead.service?.name ?? 'General enquiry'} · {lead.area ?? lead.address ?? '—'}
              </p>
            </div>
            <SlaChip sla={lead.sla} />
          </div>

          {/* What they asked for, so the caller knows before dialling. */}
          {lead.message ? (
            <p className="mt-3 line-clamp-2 rounded-md bg-muted/60 px-3 py-2 text-sm" title={lead.message}>
              {lead.message}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>Received {formatDateTime(lead.createdAt)}</span>
            <span aria-hidden>·</span>
            {owner
              ? <span>Owner {owner.name}</span>
              : <StateBadge tone="warning"><UserX className="mr-1 h-3 w-3" aria-hidden />Nobody owns this</StateBadge>}
            {lead.preferredLocale === 'ne' ? <StateBadge tone="info"><span lang="ne">नेपाली</span></StateBadge> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default">
              <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> {lead.phone}</a>
            </Button>
            {whatsapp ? (
              <Button asChild size="sm" variant="outline">
                <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`}>
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            ) : null}
            {canTake ? (
              <Button size="sm" variant="outline" onClick={take} disabled={taking}>
                {taking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Take it
              </Button>
            ) : null}
            {canWrite ? (
              // Logging the contact is what stops the clock — changing the status is not enough, by design.
              <Button size="sm" variant="outline" onClick={() => onLog(lead)}>
                <CheckCircle2 className="h-4 w-4" /> Log response
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link to={`/admin/leads/${lead.id}`} aria-label={`Open ${lead.name}`}>Open <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Stagger.Item>
  );
}

function Column({ title, icon: Icon, tone, leads, emptyText, onLog }) {
  return (
    <section aria-label={title}>
      <h2 className={cn('mb-3 flex items-center gap-2 text-sm font-semibold', tone === 'breach' ? 'text-destructive' : 'text-sla-warn')}>
        <Icon className="h-4 w-4" aria-hidden />
        {title}
        <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs tabular-nums">{leads.length}</span>
      </h2>
      {leads.length ? (
        <Stagger className="space-y-3">
          <AnimatePresence mode="popLayout">
            {leads.map((lead) => <LeadCard key={lead.id} lead={lead} tone={tone} onLog={onLog} />)}
          </AnimatePresence>
        </Stagger>
      ) : (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{emptyText}</CardContent></Card>
      )}
    </section>
  );
}

/** One number at the top of the board. A tile with `onClick` narrows the board to what it counts. */
function Tile({ label, value, hint, tone, onClick, pressed }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-semibold tabular-nums', tone === 'breach' && value ? 'text-destructive' : null, tone === 'warn' && value ? 'text-sla-warn' : null)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  return (
    <Card className={cn(pressed && 'ring-2 ring-primary')}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={pressed} className="w-full rounded-lg p-3 text-left hover:bg-muted/50">
          {body}
        </button>
      ) : <CardContent className="p-3">{body}</CardContent>}
    </Card>
  );
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
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching} aria-label="Refresh the board">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin motion-reduce:animate-none')} />
            {fulfilledTimeStamp ? `Updated ${formatTime(new Date(fulfilledTimeStamp).toISOString())}` : 'Refresh'}
          </Button>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Deadline passed" value={allBreached.length} tone="breach" />
        <Tile label="Due soon" value={allAtRisk.length} tone="warn" />
        <Tile
          label="Nobody owns" value={unowned} tone={unowned ? 'warn' : undefined}
          hint={unowned ? 'Show only these' : 'Every waiting lead has an owner'}
          onClick={unowned || scope === 'unassigned' ? () => setScope(scope === 'unassigned' ? 'all' : 'unassigned') : undefined}
          pressed={scope === 'unassigned'}
        />
        <Tile
          label="Answered in time today"
          value={answered ? `${met} of ${answered}` : '—'}
          hint={`${data?.newToday ?? 0} new enquir${data?.newToday === 1 ? 'y' : 'ies'} today`}
        />
      </div>

      <div className="mb-4">
        <ToggleGroup
          type="single" variant="outline" size="sm" value={scope} aria-label="Whose leads"
          onValueChange={(v) => v && setScope(v)} className="justify-start"
        >
          {SLA_SCOPES.map((s) => <ToggleGroupItem key={s.value} value={s.value}>{s.label}</ToggleGroupItem>)}
        </ToggleGroup>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Column
            title="Deadline passed" icon={AlertTriangle} tone="breach" leads={breached}
            emptyText="No breaches. Good." onLog={setLogging}
          />
          <Column
            title="Due soon" icon={Timer} tone="warn" leads={atRisk}
            emptyText="Nothing approaching a deadline." onLog={setLogging}
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
