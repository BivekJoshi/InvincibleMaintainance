import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, CalendarCheck, Phone, Mail, MapPin, Loader2, ClipboardCheck, FileText, Send } from 'lucide-react';
import {
  useGetLeadQuery,
  useAddLeadActivityMutation,
  useAddLeadNoteMutation,
} from '@/api/leadsApi';
import { ScheduleVisitDialog } from '@/components/leads/ScheduleVisitDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { SlaChip } from '@/components/common/SlaChip';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/helpers/format';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // DISPATCHER holds leads:read but not leads:write — every action here writes.
  const { can } = useAuth();
  const canWrite = can('leads:write');
  const { data: lead, isLoading, error, refetch } = useGetLeadQuery(id);
  const [logActivity, { isLoading: logging }] = useAddLeadActivityMutation();
  const [addNote, { isLoading: notingSaving }] = useAddLeadNoteMutation();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [note, setNote] = useState('');

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const logCall = async () => {
    try {
      await logActivity({ id, type: 'call', summary: 'Called the customer' }).unwrap();
      dispatch(toastSuccess('Call logged', 'The response clock has stopped.'));
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not log the call'));
    }
  };

  const saveNote = async () => {
    try {
      await addNote({ id, note }).unwrap();
      setNote('');
      dispatch(toastSuccess('Note added'));
    } catch (err) {
      dispatch(toastError(err?.data?.error?.message ?? 'Could not add the note'));
    }
  };

  const survey = lead.jobs?.map((j) => j.survey).find(Boolean);

  return (
    <PageTransition>
      <PageHeader
        title={lead.name}
        description={lead.service?.name ?? 'General enquiry'}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/leads')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {canWrite ? (
              <>
                <Button variant="outline" size="sm" onClick={logCall} disabled={logging || Boolean(lead.firstResponseAt)}>
                  {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  {lead.firstResponseAt ? 'Responded' : 'Log call'}
                </Button>
                <Button size="sm" onClick={() => setScheduleOpen(true)}>
                  <CalendarCheck className="h-4 w-4" /> Book visit
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          <PriorityBadge priority={lead.priority} />
          <SlaChip sla={lead.sla} />
          <span className="text-xs text-muted-foreground">{titleCase(lead.source)}</span>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">What they asked for</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lead.message ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{lead.message}</p> : null}
              {lead.estimatedAmount ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Website estimate: </span>
                  <span className="font-medium">{formatNpr(lead.estimatedAmount)}</span>
                </p>
              ) : null}
              {lead.preferredAt ? (
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
                  Requested {formatDate(lead.preferredAt)}
                  {lead.preferredSlot ? ` · ${lead.preferredSlot}` : ''}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {(lead.jobs?.length || lead.quotations?.length || survey) ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Where it got to</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.jobs?.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs">{j.number}</span> · {j.title}
                    </span>
                    <StatusBadge status={j.status} />
                  </div>
                ))}
                {survey ? (
                  <Link to={`/admin/surveys/${survey.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted">
                    <span className="inline-flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />
                      <span className="font-mono text-xs">{survey.number}</span>
                    </span>
                    <StatusBadge status={survey.status} />
                  </Link>
                ) : null}
                {(can('quotations:read') ? lead.quotations ?? [] : []).map((q) => (
                  <Link key={q.id} to={`/admin/quotations/${q.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" aria-hidden />
                      <span className="font-mono text-xs">{q.number}</span> · {formatNpr(q.total)}
                    </span>
                    <StatusBadge status={q.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
            <CardContent>
              {canWrite ? (
                <div className="space-y-2">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note…" />
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={saveNote} disabled={!note.trim() || notingSaving}>
                      {notingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Add note
                    </Button>
                  </div>
                </div>
              ) : null}
              <Stagger className="mt-4 space-y-3">
                {(lead.activities ?? []).map((a) => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                    <div className="min-w-0">
                      <p className="leading-snug">{a.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.createdAt)}{a.user?.name ? ` · ${a.user.name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {(lead.notes ?? []).map((n) => (
                  <div key={n.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap leading-snug">{n.note}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}{n.user?.name ? ` · ${n.user.name}` : ''}</p>
                    </div>
                  </div>
                ))}
              </Stagger>
            </CardContent>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <a href={`tel:${lead.phone}`} className="flex items-center gap-2 hover:text-primary">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden /> {lead.phone}
            </a>
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 break-all hover:text-primary">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> {lead.email}
              </a>
            ) : null}
            {lead.address ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> {lead.address}
              </p>
            ) : null}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              <p>Received {formatDateTime(lead.createdAt)}</p>
              {lead.assignedTo ? <p>Owned by {lead.assignedTo.name}</p> : <p>Unassigned</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {canWrite ? <ScheduleVisitDialog lead={lead} open={scheduleOpen} onOpenChange={setScheduleOpen} /> : null}
    </PageTransition>
  );
}
