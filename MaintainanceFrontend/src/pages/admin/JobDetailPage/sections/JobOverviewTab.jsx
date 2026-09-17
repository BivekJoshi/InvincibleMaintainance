import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ClipboardCheck, Contact, ExternalLink, FileText, MapPin, Pencil, Phone, ShieldCheck, Star, Users, Wrench,
} from 'lucide-react';
import { useUpdateJobMutation } from '@/api/jobsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { StateBadge } from '@/components/common/StateBadge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { jobUpdateSchema } from '@/form/schemas/job.schema';
import { JOB_STATUS_LABELS, JOB_TYPES, JOB_TYPE_LABELS, PRIORITIES, QUOTATION_STATUS_LABELS } from '@/config/constants';
import { formatDate, formatDateTime, formatNpr, formatTime, titleCase } from '@/helpers/format';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { siteMapHref } from '@/helpers/jobActions';

const CLOSED = ['COMPLETED', 'VERIFIED', 'CANCELLED'];
const row = 'flex items-center justify-between gap-3 rounded-md border px-3 py-2';

const editFields = [
  { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 250 },
  { name: 'type', type: 'select', label: 'Type', required: true, span: 'half', options: JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })) },
  { name: 'priority', type: 'select', label: 'Priority', required: true, span: 'half', options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
  { name: 'description', type: 'textarea', label: 'What needs doing', rows: 4 },
  { name: 'isBillable', type: 'switch', label: 'Billable', description: 'Off for a free inspection or warranty work.' },
];

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/** Who, where, from what, when, by whom — and the finish, once there is one. */
export function JobOverviewTab({ job, can }) {
  const dispatch = useDispatch();
  const [update] = useUpdateJobMutation();
  const [editing, setEditing] = useState(false);
  const canEdit = can('jobs:write') && !CLOSED.includes(job.status);
  const map = siteMapHref(job.site);
  const crew = [...(job.assignments ?? [])].sort((a, b) => Number(b.isLead) - Number(a.isLead));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Contact className="h-4 w-4 text-primary" aria-hidden /> Customer and site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            {can('customers:read') ? (
              <Link to={`/admin/customers/${job.customer.id}`} className="font-medium hover:underline">{job.customer.name}</Link>
            ) : <p className="font-medium">{job.customer.name}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              {job.customer.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${job.customer.phone}`}><Phone aria-hidden /> {job.customer.phone}</a>
                </Button>
              ) : null}
              {job.customer.email ? <span className="self-center text-xs text-muted-foreground">{job.customer.email}</span> : null}
              {job.customer.preferredLocale === 'ne' ? <StateBadge tone="info">Messages in Nepali</StateBadge> : null}
            </div>
          </div>
          {job.site ? (
            <div className="rounded-md border p-3">
              <p className="font-medium">{job.site.label}</p>
              <p className="text-muted-foreground">{[job.site.address, job.site.area].filter(Boolean).join(', ')}</p>
              {job.site.accessNotes ? <p className="mt-1 text-xs">Access: {job.site.accessNotes}</p> : null}
              {map ? (
                <Button asChild size="sm" variant="link" className="mt-1 h-auto px-0">
                  <a href={map} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden /> Open in Maps <ExternalLink className="h-3 w-3" aria-hidden /></a>
                </Button>
              ) : null}
            </div>
          ) : <p className="text-muted-foreground">No site on this job.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" aria-hidden /> Where it came from</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {job.lead ? (
            can('leads:read') ? (
              <Link to={`/admin/leads/${job.lead.id}`} className={`${row} hover:bg-muted`}><span>Lead · {job.lead.name}</span><span className="text-xs text-muted-foreground">Open</span></Link>
            ) : <p className={row}>Lead · {job.lead.name}</p>
          ) : null}
          {job.quotation ? (
            can('quotations:read') ? (
              <Link to={`/admin/quotations/${job.quotation.id}`} className={`${row} hover:bg-muted`}>
                <span><span className="font-mono text-xs">{job.quotation.number}</span> · {formatNpr(job.quotation.total)}</span>
                <StatusBadge status={job.quotation.status} label={QUOTATION_STATUS_LABELS[job.quotation.status]} />
              </Link>
            ) : <p className={row}><span className="font-mono text-xs">{job.quotation.number}</span></p>
          ) : null}
          {job.survey ? (
            can('surveys:read') ? (
              <Link to={`/admin/surveys/${job.survey.id}`} className={`${row} hover:bg-muted`}>
                <span className="inline-flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" aria-hidden /><span className="font-mono text-xs">{job.survey.number}</span></span>
                <StatusBadge status={job.survey.status} />
              </Link>
            ) : <p className={row}>Survey {job.survey.number}</p>
          ) : null}
          {job.parentJob ? (
            <Link to={`/admin/jobs/${job.parentJob.id}`} className={`${row} hover:bg-muted`}>
              <span>Rework of <span className="font-mono text-xs">{job.parentJob.number}</span></span>
              <StatusBadge status={job.parentJob.status} label={JOB_STATUS_LABELS[job.parentJob.status]} />
            </Link>
          ) : null}
          {(job.childJobs ?? []).map((c) => (
            <Link key={c.id} to={`/admin/jobs/${c.id}`} className={`${row} hover:bg-muted`}>
              <span>Follow-up <span className="font-mono text-xs">{c.number}</span> · {JOB_TYPE_LABELS[c.type]}</span>
              <StatusBadge status={c.status} label={JOB_STATUS_LABELS[c.status]} />
            </Link>
          ))}
          {job.project ? (
            can('cms:read') ? (
              <Link to={`/admin/content/projects/${job.project.id}`} className={`${row} hover:bg-muted`}>
                <span>Case study · {job.project.title}</span>
                <StateBadge tone={job.project.isActive ? 'success' : 'muted'}>{job.project.isActive ? 'On site' : 'Draft'}</StateBadge>
              </Link>
            ) : <p className={row}>Case study · {job.project.title}</p>
          ) : null}
          {!job.lead && !job.quotation && !job.survey && !job.parentJob ? (
            <p className="text-muted-foreground">
              Created by hand{job.createdBy ? ` by ${job.createdBy.name}` : ''} on {formatDate(job.createdAt)}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" aria-hidden /> When and who</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact label="Booked for">
              {job.scheduledStart
                ? `${formatDateTime(job.scheduledStart)}${job.scheduledEnd ? `–${formatTime(job.scheduledEnd)}` : ''}`
                : <span className="text-muted-foreground">Not scheduled</span>}
            </Fact>
            <Fact label="Worked">
              {job.actualStart
                ? `${formatDateTime(job.actualStart)}${job.actualEnd ? ` → ${formatDateTime(job.actualEnd)}` : ''}`
                : <span className="text-muted-foreground">Not started</span>}
            </Fact>
          </dl>
          {crew.length ? (
            <ul className="space-y-2">
              {crew.map((a) => (
                <li key={a.id ?? a.technicianId} className={row}>
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{a.technician?.user?.name}</span>
                    {a.isLead ? <StateBadge tone="info">Lead</StateBadge> : null}
                  </span>
                  {a.technician?.user?.phone ? (
                    <a href={`tel:${a.technician.user.phone}`} className="text-xs text-primary hover:underline">{a.technician.user.phone}</a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">Nobody is on this job yet.</p>}
          {job.holdReason && job.status === 'ON_HOLD' ? <p className="rounded-md border surface-warning px-3 py-2">On hold: {job.holdReason}</p> : null}
          {job.cancelReason ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">Cancelled: {job.cancelReason}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">The work</CardTitle>
          {canEdit ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit details</Button> : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact label="Type">{JOB_TYPE_LABELS[job.type]}</Fact>
            <Fact label="Billing">{job.isBillable ? (job.invoicedAt ? `Invoiced ${formatDate(job.invoicedAt)}` : 'Billable') : 'Not billed'}</Fact>
          </dl>
          {job.description ? <p className="whitespace-pre-wrap">{job.description}</p> : <p className="text-muted-foreground">No description.</p>}
          {job.completionNote || job.customerRating ? (
            <div className="space-y-1 rounded-md border p-3">
              {job.completionNote ? <p className="whitespace-pre-wrap">{job.completionNote}</p> : null}
              {job.customerRating ? (
                <p className="inline-flex items-center gap-1"><Star className="h-4 w-4 text-sla-warn" aria-hidden /> {job.customerRating}/5{job.customerFeedback ? ` — “${job.customerFeedback}”` : ''}</p>
              ) : null}
            </div>
          ) : null}
          {job.warranty ? (
            <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Warranty until {formatDate(job.warranty.endsAt)}</p>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <ResourceForm
          mode="sheet"
          open={editing}
          onOpenChange={setEditing}
          title={`Edit ${job.number}`}
          description="Details only — schedule, people and status have their own buttons."
          schema={jobUpdateSchema}
          fields={editFields}
          defaultValues={job}
          guard={false}
          submitLabel="Save"
          onSubmit={async (body) => {
            await update({ id: job.id, ...body }).unwrap();
            dispatch(toastSuccess(`${job.number} saved`));
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}
