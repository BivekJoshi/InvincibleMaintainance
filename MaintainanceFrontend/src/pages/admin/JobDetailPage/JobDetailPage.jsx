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
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useJobActions } from '@/hooks/useJobActions';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { jobActions, jobWaitingFor, openTasks } from '@/helpers/jobActions';
import { ktmDay } from '@/helpers/dispatchBoard';
import { JobActionBar } from './sections/JobActionBar';
import { JobOverviewTab } from './sections/JobOverviewTab';
import { JobChecklistTab } from './sections/JobChecklistTab';
import { JobPhotosTab } from './sections/JobPhotosTab';
import { JobMaterialsTab } from './sections/JobMaterialsTab';
import { JobTimeTab } from './sections/JobTimeTab';
import { JobCostingTab } from './sections/JobCostingTab';
import { JobEventsTab } from './sections/JobEventsTab';

/**
 * One job: the actions its state allows, and the tabs — Overview · Checklist · Photos · Materials ·
 * Time · Costing · Events · History. The open tab is in the URL (`?tab=`). Status changes only
 * through the action bar's endpoints, never by editing the record.
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
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'checklist', label: 'Checklist' },
    { value: 'photos', label: 'Photos' },
    { value: 'materials', label: 'Materials' },
    { value: 'time', label: 'Time' },
    { value: 'costing', label: 'Costing' },
    { value: 'events', label: 'Events' },
    ...(can('jobs:history') ? [{ value: 'history', label: 'History' }] : []),
  ];
  const tab = tabs.some((t) => t.value === search.get('tab')) ? search.get('tab') : 'overview';
  const setTab = (next) => setSearch(next === 'overview' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const counts = {
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
        </div>
      </PageHeader>

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
        <TabsContent value="checklist"><JobChecklistTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="photos"><JobPhotosTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="materials"><JobMaterialsTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="time"><JobTimeTab job={job} canWrite={canWrite} /></TabsContent>
        <TabsContent value="costing">{tab === 'costing' ? <JobCostingTab job={job} /> : null}</TabsContent>
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
