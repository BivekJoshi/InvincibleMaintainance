import { Link } from 'react-router-dom';
import {
  Users, Timer, AlertTriangle, Briefcase, Receipt, ShieldCheck, RefreshCw, TrendingUp,
} from 'lucide-react';
import { useGetDashboardQuery } from '@/features/dashboard/dashboardApi';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger, CountUp } from '@/components/motion';
import { formatNpr } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Card definitions keyed by the API's card names; the API decides which appear. */
const CARDS = {
  leadsToday: { label: 'Leads today', icon: Users, to: '/admin/leads' },
  leadsOpen: { label: 'Open leads', icon: Users, to: '/admin/leads' },
  slaBreached: { label: 'SLA breached', icon: AlertTriangle, to: '/admin/sla', tone: 'danger' },
  slaAtRisk: { label: 'Response due soon', icon: Timer, to: '/admin/sla', tone: 'warn' },
  jobsToday: { label: 'Jobs today', icon: Briefcase, to: '/admin/jobs' },
  jobsOpen: { label: 'Open jobs', icon: Briefcase, to: '/admin/jobs' },
  jobsUnassigned: { label: 'Unassigned jobs', icon: AlertTriangle, to: '/admin/jobs', tone: 'warn' },
  outstandingAmount: { label: 'Outstanding', icon: Receipt, to: '/admin/invoices', money: true },
  outstandingInvoices: { label: 'Unpaid invoices', icon: Receipt, to: '/admin/invoices' },
  warrantiesActive: { label: 'Active warranties', icon: ShieldCheck, to: '/admin/warranties' },
  amcRenewals: { label: 'AMC renewals due', icon: RefreshCw, to: '/admin/warranties' },
};

const TONES = {
  danger: 'text-destructive',
  warn: 'text-sla-warn',
};

function StatCard({ name, value }) {
  const def = CARDS[name];
  if (!def) return null;
  const Icon = def.icon;
  const display = def.money ? formatNpr(value, { compact: true }) : value.toLocaleString();
  const highlight = def.tone && value > 0;

  return (
    <Stagger.Item>
      <Link to={def.to} className="block">
        <Card className={cn('transition-shadow hover:shadow-md', highlight && 'border-current/20', highlight && TONES[def.tone])}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{def.label}</p>
              <Icon className={cn('h-4 w-4', highlight ? TONES[def.tone] : 'text-muted-foreground')} aria-hidden />
            </div>
            <p className={cn('mt-2 text-2xl font-bold tabular-nums', highlight && TONES[def.tone])}>
              <CountUp value={display} />
            </p>
          </CardContent>
        </Card>
      </Link>
    </Stagger.Item>
  );
}

function FunnelBar({ stage, max }) {
  const pct = max ? (stage.count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{stage.label}</span>
        <span className="tabular-nums text-muted-foreground">{stage.count} · {stage.pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { data, isLoading, error, refetch } = useGetDashboardQuery();

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const cards = Object.entries(data?.cards ?? {});
  const funnel = data?.funnel;
  const sla = data?.sla;

  return (
    <PageTransition>
      <PageHeader
        title={`Good day, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description={`Here is what needs your attention as ${role}.`}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([name, value]) => <StatCard key={name} name={name} value={value} />)}
        </Stagger>
      )}

      {(funnel || sla) && !isLoading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {funnel ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" /> Conversion funnel · last 30 days
                </h2>
                <div className="mt-4 space-y-3">
                  {funnel.stages.map((s) => <FunnelBar key={s.key} stage={s} max={funnel.total} />)}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{funnel.lost} lead(s) marked lost.</p>
              </CardContent>
            </Card>
          ) : null}

          {sla ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Timer className="h-4 w-4 text-muted-foreground" /> Response promise · last 30 days
                </h2>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{sla.complianceRate}%</p>
                    <p className="text-xs text-muted-foreground">on time</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{sla.medianResponseMinutes ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">median minutes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-destructive">{sla.neverResponded}</p>
                    <p className="text-xs text-muted-foreground">never answered</p>
                  </div>
                </div>
                {sla.byStaff?.length ? (
                  <ul className="mt-5 space-y-2 border-t pt-4 text-sm">
                    {sla.byStaff.slice(0, 4).map((s) => (
                      <li key={s.staff} className="flex items-center justify-between">
                        <span className="truncate">{s.staff}</span>
                        <span className="tabular-nums text-muted-foreground">{s.onTime}/{s.total} · {s.complianceRate}%</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageTransition>
  );
}
