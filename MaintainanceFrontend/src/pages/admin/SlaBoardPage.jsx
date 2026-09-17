import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, AlertTriangle, Timer, CheckCircle2, ArrowRight } from 'lucide-react';
import { useGetSlaBoardQuery } from '@/api/leadsApi';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { SlaChip } from '@/components/common/SlaChip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PageTransition, Stagger, AnimatePresence } from '@/three/motion/motionKit';
import { formatDateTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

function LeadCard({ lead, tone, onLog }) {
  // The board is route-guarded on leads:read, but logging a response writes.
  const { can } = useAuth();
  const canWrite = can('leads:write');

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

          <p className="mt-3 text-xs text-muted-foreground">
            Received {formatDateTime(lead.createdAt)}
            {lead.assignedTo ? ` · assigned to ${lead.assignedTo.name}` : ' · unassigned'}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default">
              <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /> {lead.phone}</a>
            </Button>
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
    <section>
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

/**
 * The board that makes the public "2-hour response" promise operational.
 * Polls every 30s so a countdown never goes stale on a wall display.
 */
export default function SlaBoardPage() {
  const { data, isLoading, error, refetch } = useGetSlaBoardQuery(undefined, { pollingInterval: 30000 });
  const [logging, setLogging] = useState(null);

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const breached = data?.breached ?? [];
  const atRisk = data?.atRisk ?? [];
  const clear = !isLoading && !breached.length && !atRisk.length;

  return (
    <PageTransition>
      <PageHeader
        title="Response board"
        description={`We promise a two-hour response. ${data?.newToday ?? 0} enquiry(s) arrived today.`}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : clear ? (
        <EmptyState
          icon={CheckCircle2}
          title="Every enquiry has been answered in time"
          description="Nothing is breached and nothing is approaching its deadline. This board refreshes every 30 seconds."
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
