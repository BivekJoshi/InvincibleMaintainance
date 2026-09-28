import { useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useGetJobQuery } from '@/api/jobsApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { RecordHistory } from '@/components/common/RecordHistory';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AwaitingAdvanceChip } from '@/components/jobs/AwaitingAdvanceChip';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useJobActions } from '@/hooks/useJobActions';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { jobActions, jobWaitingFor, openTasks } from '@/helpers/jobActions';
import { ktmDay } from '@/helpers/dispatchBoard';
import { JobActionBar } from './sections/JobActionBar';
import { JobAdvanceCard } from './sections/JobAdvanceCard';
import { JobOverviewTab } from './sections/JobOverviewTab';
import { JobPlanTab } from './sections/JobPlanTab';
import { JobChecklistTab } from './sections/JobChecklistTab';
import { JobPhotosTab } from './sections/JobPhotosTab';
import { JobMaterialsTab } from './sections/JobMaterialsTab';
import { JobTimeTab } from './sections/JobTimeTab';
import { JobCostingTab } from './sections/JobCostingTab';
import { JobEventsTab } from './sections/JobEventsTab';
import { JobProgressTab } from './sections/JobProgressTab';
import { JobPlannedActualTab } from './sections/JobPlannedActualTab';
import { JobDiaryTab } from './sections/JobDiaryTab';
import { JobVariationsTab } from './sections/JobVariationsTab';

/**
 * One job: the actions its state allows, and the tabs — Overview · Plan · Checklist · Photos · Materials ·
 * Time · Costing · Events · History. The open tab is in the URL (`?tab=`). Status changes only
 * through the action bar's endpoints, never by editing the record. Costing is cost and margin, so it
 * is there only for `costs:read` (the money wall, Phase L2) — the API answers 403 to anyone else.
 *
 * Phase L6: the **Plan** tab is there only on a BOQ job (one with job lines from its accepted quotation); the
 * advance card sits above the tabs and the "Awaiting advance" chip in the header while the advance gate holds —
 * Schedule, Assign and the moves on stay on the bar, disabled with the reason (`helpers/jobActions`).
 *
 * Phase L7 — the weeks on site: **BOQ & progress** and **Materials / Labour** on a BOQ job, **Site diary** on any job
 * but an inspection, and **Variations** on a quoted job (one from a quotation, or with lines). Each tab loads its own
 * data only while it is open.
 */
export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { can } = useAuth();
  const { data: job, isLoading, error, refetch } = useGetJobQuery(id);
  const onDeleted = useCallback(() => navigate('/admin/jobs', { replace: true }), [navigate]);
  const [runAction, actionDialogs] = useJobActions({ onDeleted });

  const canWrite = can('jobs:write');
  // A BOQ job: its accepted quotation's rows became job lines (Phase L6). Only such a job has a plan.
  const lineCount = job?.lines?.length ?? 0;
  const onSite = job && job.type !== 'INSPECTION';
  const quoted = lineCount > 0 || Boolean(job?.quotation);
  const tabs = [
    { value: 'overview', label: 'Overview' },
    ...(lineCount > 0 ? [{ value: 'plan', label: 'Plan' }] : []),
    ...(lineCount > 0 ? [{ value: 'progress', label: 'BOQ & progress' }, { value: 'planned', label: 'Materials / Labour' }] : []),
    ...(onSite ? [{ value: 'diary', label: 'Site diary' }] : []),
    ...(quoted && onSite ? [{ value: 'variations', label: 'Variations' }] : []),
    { value: 'checklist', label: 'Checklist' },
    { value: 'photos', label: 'Photos' },
    { value: 'materials', label: 'Materials' },
    { value: 'time', label: 'Time' },
    ...(can('costs:read') ? [{ value: 'costing', label: 'Costing' }] : []),
    { value: 'events', label: 'Events' },
    ...(can('jobs:history') ? [{ value: 'history', label: 'History' }] : []),
  ];
  const tab = tabs.some((t) => t.value === search.get('tab')) ? search.get('tab') : 'overview';
  const setTab = (next) => setSearch(next === 'overview' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const counts = {
    plan: lineCount || null,
    checklist: job.tasks?.length ? `${job.tasks.length - openTasks(job).length}/${job.tasks.length}` : null,
    photos: job.photos?.length || null,
    materials: job.materials?.length || null,
    time: job.timeLogs?.length || null,
  };

  return (
    <PageTransition>
      <PageHeader
        title={`${job.number} · ${job.title}`}
        description={`${JOB_TYPE_LABELS[job.type]} for ${job.customer.name} — ${jobWaitingFor(job)}`}
        actions={(
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/jobs')}><ArrowLeft /> Jobs</Button>
              {can('jobs:dispatch') && job.scheduledStart ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/admin/dispatch?date=${ktmDay(job.scheduledStart)}`}>
                    <CalendarDays /> On the board
                  </Link>
                </Button>
              ) : null}
            </div>
            <JobActionBar actions={jobActions(job, { can })} onRun={(a) => runAction(a, job)} />
          </div>
        )}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} label={JOB_STATUS_LABELS[job.status]} />
          <PriorityBadge priority={job.priority} />
          <AwaitingAdvanceChip job={job} />
        </div>
      </PageHeader>

      <JobAdvanceCard job={job} can={can} />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}{counts[t.value] ? <span className="ml-1 text-xs text-muted-foreground">({counts[t.value]})</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview"><JobOverviewTab job={job} can={can} /></TabsContent>
        {lineCount > 0 ? (
          <TabsContent value="plan">{tab === 'plan' ? <JobPlanTab job={job} /> : null}</TabsContent>
        ) : null}
        {lineCount > 0 ? (
          <>
            <TabsContent value="progress">{tab === 'progress' ? <JobProgressTab job={job} /> : null}</TabsContent>
            <TabsContent value="planned">{tab === 'planned' ? <JobPlannedActualTab job={job} /> : null}</TabsContent>
          </>
        ) : null}
        {onSite ? <TabsContent value="diary">{tab === 'diary' ? <JobDiaryTab job={job} /> : null}</TabsContent> : null}
        {quoted && onSite ? (
          <TabsContent value="variations">{tab === 'variations' ? <JobVariationsTab job={job} /> : null}</TabsContent>
        ) : null}
        <TabsContent value="checklist"><JobChecklistTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="photos"><JobPhotosTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="materials"><JobMaterialsTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="time"><JobTimeTab job={job} canWrite={canWrite} /></TabsContent>
        {can('costs:read') ? (
          <TabsContent value="costing">{tab === 'costing' ? <JobCostingTab job={job} /> : null}</TabsContent>
        ) : null}
        <TabsContent value="events"><JobEventsTab job={job} /></TabsContent>
        {can('jobs:history') ? (
          <TabsContent value="history">
            {tab === 'history' ? <RecordHistory endpoint={`/admin/jobs/${job.id}/history`} /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
      {actionDialogs}
    </PageTransition>
  );
}
