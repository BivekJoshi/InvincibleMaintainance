import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft, CalendarCheck, ChevronDown, ClipboardCheck, Contact, FileText, Pencil, Trash2, UserPlus, UserRoundCheck,
} from 'lucide-react';
import { useDeleteLeadMutation, useGetLeadDuplicatesQuery, useGetLeadQuery } from '@/api/leadsApi';
import { ScheduleVisitDialog } from '@/components/leads/ScheduleVisitDialog';
import { ConvertLeadSheet } from '@/components/leads/ConvertLeadSheet';
import { ConvertResult } from '@/components/leads/ConvertResult';
import { LeadFormSheet } from '@/components/leads/LeadFormSheet';
import { LeadStatusMenu } from '@/components/leads/LeadStatusMenu';
import { AssignLeadDialog } from '@/components/leads/AssignLeadDialog';
import { ActivityComposer } from '@/components/leads/ActivityComposer';
import { DuplicatesPanel } from '@/components/leads/DuplicatesPanel';
import { LeadRequestPanel } from '@/components/leads/LeadRequestPanel';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { SlaChip } from '@/components/common/SlaChip';
import { StateBadge } from '@/components/common/StateBadge';
import { RecordHistory } from '@/components/common/RecordHistory';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useLeadStatusChange } from '@/hooks/useLeadStatusChange';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { ACTIVITY_LABELS, LEAD_SOURCE_LABELS } from '@/config/constants';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/helpers/format';

const TABS = ['overview', 'duplicates', 'history'];

function Timeline({ lead }) {
  const entries = [
    ...(lead.activities ?? []).map((a) => ({ id: `a-${a.id}`, at: a.createdAt, kind: a.type, text: a.summary, who: a.user?.name })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at));
  if (!entries.length) return <p className="text-sm text-muted-foreground">Nothing logged yet.</p>;
  return (
    <Stagger className="space-y-3">
      {entries.map((e) => (
        <Stagger.Item key={e.id} className="flex gap-3 text-sm">
          <span className="mt-0.5 w-20 shrink-0">
            <StateBadge tone={['note', 'status_change', 'assignment'].includes(e.kind) ? 'muted' : 'info'}>
              {ACTIVITY_LABELS[e.kind] ?? titleCase(e.kind)}
            </StateBadge>
          </span>
          <div className="min-w-0">
            <p className="whitespace-pre-wrap break-words leading-snug">{e.text}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}{e.who ? ` · ${e.who}` : ''}</p>
          </div>
        </Stagger.Item>
      ))}
    </Stagger>
  );
}

function LinkedRecords({ lead, can }) {
  const jobs = lead.jobs ?? [];
  const quotations = can('quotations:read') ? lead.quotations ?? [] : [];
  const row = 'flex items-center justify-between gap-3 rounded-md border px-3 py-2';
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Where it got to</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {lead.customer ? (
          can('customers:read') ? (
            <Link to={`/admin/customers/${lead.customer.id}`} className={`${row} hover:bg-muted`}>
              <span className="inline-flex min-w-0 items-center gap-2"><Contact className="h-4 w-4 text-primary" aria-hidden /><span className="truncate">{lead.customer.name}</span></span>
              <span className="text-xs text-muted-foreground">Customer</span>
            </Link>
          ) : <p className={row}>{lead.customer.name}</p>
        ) : <p className="text-muted-foreground">Not converted yet.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="space-y-2">
            <div className={row}>
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs">{j.number}</span> · {j.title ?? titleCase(j.type)}
                {j.scheduledStart ? <span className="block text-xs text-muted-foreground">{formatDate(j.scheduledStart)}</span> : null}
              </span>
              <StatusBadge status={j.status} />
            </div>
            {j.survey ? (
              <Link to={`/admin/surveys/${j.survey.id}`} className={`${row} ml-4 hover:bg-muted`}>
                <span className="inline-flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-mono text-xs">{j.survey.number}</span>
                </span>
                <StatusBadge status={j.survey.status} />
              </Link>
            ) : null}
          </div>
        ))}
        {quotations.map((q) => (
          <Link key={q.id} to={`/admin/quotations/${q.id}`} className={`${row} hover:bg-muted`}>
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden />
              <span className="font-mono text-xs">{q.number}</span> · {formatNpr(q.total)}
            </span>
            <StatusBadge status={q.status} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * One lead, worked end to end: edit, move, assign, log contact, merge duplicates,
 * convert (with or without a visit), and its History.
 */
export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [search, setSearch] = useSearchParams();
  // DISPATCHER holds leads:read but not leads:write — every action here writes.
  const { can } = useAuth();
  const canWrite = can('leads:write');
  const { data: lead, isLoading, error, refetch } = useGetLeadQuery(id);
  const { data: duplicates } = useGetLeadDuplicatesQuery(id);
  const [deleteLead] = useDeleteLeadMutation();
  const [changeStatus, statusDialog] = useLeadStatusChange();
  const [confirm, confirmDialog] = useConfirm();
  const [open, setOpen] = useState(null); // 'edit' | 'assign' | 'visit' | 'convert'
  const [converted, setConverted] = useState(null);

  const tab = TABS.includes(search.get('tab')) ? search.get('tab') : 'overview';
  const setTab = (next) => setSearch(next === 'overview' ? {} : { tab: next }, { replace: true });
  const close = (isOpen) => { if (!isOpen) setOpen(null); };

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete the lead for ${lead.name}?`,
      description: 'It leaves every list. Its history stays in the audit log.',
      confirmLabel: 'Delete lead',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteLead(lead.id).unwrap();
      dispatch(toastSuccess('Lead deleted'));
      navigate('/admin/leads', { replace: true });
    } catch (err) {
      dispatch(toastError('Could not delete the lead', err?.data?.error?.message));
    }
  };

  const closed = ['WON', 'LOST'].includes(lead.status);

  return (
    <PageTransition>
      <PageHeader
        title={lead.name}
        description={`${lead.service?.name ?? 'General enquiry'} · ${LEAD_SOURCE_LABELS[lead.source] ?? titleCase(lead.source)}`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/leads')}>
              <ArrowLeft /> Leads
            </Button>
            {canWrite ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen('edit')}><Pencil /> Edit</Button>
                <LeadStatusMenu lead={lead} onChange={(to) => changeStatus(lead, to)} />
                <Button variant="outline" size="sm" onClick={() => setOpen('assign')}><UserPlus /> Assign</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={lead.status === 'WON'}>
                      <UserRoundCheck /> Convert <ChevronDown aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setOpen('visit')}>
                      <CalendarCheck className="h-4 w-4" /> Book the inspection visit…
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setOpen('convert')}>
                      <Contact className="h-4 w-4" /> Convert without a visit…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete lead"><Trash2 className="text-destructive" /></Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          <PriorityBadge priority={lead.priority} />
          {!closed || lead.sla?.state === 'met' ? <SlaChip sla={lead.sla} /> : null}
          <span className="text-xs text-muted-foreground">{lead.assignedTo ? `Owned by ${lead.assignedTo.name}` : 'Unassigned'}</span>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates{duplicates?.length ? ` (${duplicates.length})` : ''}</TabsTrigger>
          {can('leads:history') ? <TabsTrigger value="history">History</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {duplicates?.length && tab === 'overview' ? (
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-md border surface-warning px-3 py-2 text-sm">
              {duplicates.length} other lead{duplicates.length === 1 ? ' has' : 's have'} this phone or email.
              <Button size="sm" variant="outline" onClick={() => setTab('duplicates')}>Review</Button>
            </p>
          ) : null}
          <LeadRequestPanel lead={lead} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Activity</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {canWrite ? <ActivityComposer lead={lead} defaultType={lead.firstResponseAt ? 'note' : 'call'} /> : null}
                <Timeline lead={lead} />
              </CardContent>
            </Card>
            <div className="space-y-4 self-start">
              <LinkedRecords lead={lead} can={can} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="duplicates">
          <DuplicatesPanel lead={lead} canWrite={canWrite} />
        </TabsContent>

        {can('leads:history') ? (
          <TabsContent value="history">
            {tab === 'history' ? <RecordHistory endpoint={`/admin/leads/${lead.id}/history`} /> : null}
          </TabsContent>
        ) : null}
      </Tabs>

      {canWrite ? (
        <>
          <LeadFormSheet lead={lead} open={open === 'edit'} onOpenChange={close} />
          <AssignLeadDialog leads={[lead]} open={open === 'assign'} onOpenChange={close} />
          {open === 'visit' ? (
            <ScheduleVisitDialog lead={lead} open onOpenChange={close} onScheduled={setConverted} />
          ) : null}
          {open === 'convert' ? (
            <ConvertLeadSheet lead={lead} open onOpenChange={close} onConverted={setConverted} />
          ) : null}
          <ConvertResult result={converted} onOpenChange={(o) => { if (!o) setConverted(null); }} />
          {statusDialog}
        </>
      ) : null}
      {confirmDialog}
    </PageTransition>
  );
}
