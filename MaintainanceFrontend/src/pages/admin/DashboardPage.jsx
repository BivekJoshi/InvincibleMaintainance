import { SHELL_POLL_MS } from '@/config/constants';
import { DASHBOARD_GROUPS } from '@/config/admin/dashboardCards';
import { useGetDashboardQuery } from '@/api/dashboardApi';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { MetricGroup } from '@/components/dashboard/MetricGroup';
import { LatestCard } from '@/components/dashboard/LatestCard';
import { LeadTrendCard } from '@/components/dashboard/LeadTrendCard';
import { SlaCard } from '@/components/dashboard/SlaCard';
import { SlaQueueCard } from '@/components/dashboard/SlaQueueCard';
import { PipelineCard } from '@/components/dashboard/PipelineCard';
import { FunnelCard } from '@/components/dashboard/FunnelCard';
import { HeatmapCard } from '@/components/dashboard/HeatmapCard';
import { LeadSourcesCard } from '@/components/dashboard/LeadSourcesCard';
import { TodayJobsCard } from '@/components/dashboard/TodayJobsCard';
import { TechLoadCard } from '@/components/dashboard/TechLoadCard';
import { JobsWeekCard } from '@/components/dashboard/JobsWeekCard';
import { JobStatusCard } from '@/components/dashboard/JobStatusCard';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
import { groupCards, percentChange } from '@/helpers/dashboard';
import { cn } from '@/helpers/utils';

// Written out so Tailwind sees every class.
const SPAN = {
  3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 12: 'lg:col-span-12',
};

/**
 * The page's sections, each a list of rows on a 12-column grid. A widget the API
 * did not send drops out; the last one left in a row widens to close the gap.
 */
const SECTIONS = [
  {
    key: 'sales',
    label: 'Sales and response',
    rows: [
      [['leadTrend', 8, (d) => <LeadTrendCard data={d.leadTrend} />], ['sla', 4, (d) => <SlaCard sla={d.sla} />]],
      [
        ['slaQueue', 5, (d) => <SlaQueueCard queue={d.slaQueue} />],
        ['quotationPipeline', 4, (d) => <PipelineCard pipeline={d.quotationPipeline} />],
        ['funnel', 3, (d) => <FunnelCard funnel={d.funnel} />],
      ],
      [['leadHeatmap', 7, (d) => <HeatmapCard heatmap={d.leadHeatmap} />], ['sources', 5, (d) => <LeadSourcesCard sources={d.sources} />]],
    ],
  },
  {
    key: 'ops',
    label: 'Operations',
    rows: [
      [['todaysJobs', 8, (d) => <TodayJobsCard sheet={d.todaysJobs} />], ['technicianLoad', 4, (d) => <TechLoadCard load={d.technicianLoad} />]],
      [['jobsWeek', 7, (d) => <JobsWeekCard data={d.jobsWeek} />], ['jobStatus', 5, (d) => <JobStatusCard counts={d.jobStatus} />]],
    ],
  },
  {
    key: 'money',
    label: 'Money',
    rows: [[['revenue', 12, (d) => <RevenueCard revenue={d.revenue} />]]],
  },
];

/** The sections with something in them, their rows packed to fill twelve columns. */
function layout(data) {
  return SECTIONS.map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => row.filter(([key]) => data[key] != null))
      .filter((row) => row.length)
      .map((row) => {
        const used = row.reduce((n, [, span]) => n + span, 0);
        return row.map(([key, span, render], i) => ({
          key, render, span: i === row.length - 1 ? span + 12 - used : span,
        }));
      }),
  })).filter((s) => s.rows.length);
}

/** A tile's extras, from the chart data the same payload carries. */
function tileExtras(data) {
  return (name) => {
    if (name !== 'leadsToday' || !data.leadTrend?.length) return {};
    const counts = data.leadTrend.map((d) => d.leads);
    const sum = (a) => a.reduce((n, v) => n + v, 0);
    const pct = percentChange(sum(counts.slice(-7)), sum(counts.slice(-14, -7)));
    return { trend: counts, delta: pct == null ? undefined : { pct, label: 'this week vs last' } };
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-[236px] rounded-xl lg:col-span-4" />
      </div>
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-xl lg:col-span-8" />
        <Skeleton className="h-72 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}

/**
 * The back office's front page. The API decides what each role sees; this page
 * lays out whatever arrived: the numbers grouped beside your inbox, then a section
 * per area of the business.
 */
export default function DashboardPage() {
  const { user, role } = useAuth();
  // The shell's cadence: the notification and SLA badges refresh on the same beat.
  const { data, isLoading, isFetching, error, refetch } = useGetDashboardQuery(undefined, { pollingInterval: SHELL_POLL_MS });

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const groups = groupCards(data?.cards, DASHBOARD_GROUPS);
  const sections = data ? layout(data) : [];

  return (
    <PageTransition className="space-y-4">
      <DashboardHero name={user?.name} role={role} cards={data?.cards} loading={isLoading} />

      {isLoading ? <DashboardSkeleton /> : (
        // Refetches keep the frame: the old numbers stay until the new ones land.
        <div className={cn('space-y-5 transition-opacity', isFetching && 'opacity-90')}>
          <Stagger className="grid items-start gap-3 lg:grid-cols-12">
            <div className="grid gap-3 lg:col-span-8">
              {groups.map((g) => (
                <MetricGroup key={g.key} label={g.label} items={g.items} extras={tileExtras(data)} />
              ))}
            </div>
            <Stagger.Item className="flex self-stretch lg:col-span-4 [&>section]:flex-1">
              <LatestCard limit={groups.length > 2 ? 7 : 5} />
            </Stagger.Item>
          </Stagger>

          {sections.map((section) => (
            <section key={section.key} aria-labelledby={`dash-${section.key}`} className="space-y-3">
              <h2 id={`dash-${section.key}`} className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h2>
              {section.rows.map((row) => (
                <Stagger key={row.map((w) => w.key).join('-')} className="grid gap-3 lg:grid-cols-12" stagger={0.07}>
                  {row.map((w) => (
                    <div key={w.key} className={cn('flex min-w-0 [&>section]:flex-1', SPAN[w.span])}>
                      {w.render(data)}
                    </div>
                  ))}
                </Stagger>
              ))}
            </section>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
