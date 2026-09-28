import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft, Ban, Briefcase, Contact, Copy, ExternalLink, LifeBuoy, Pencil, Phone, ShieldCheck,
} from 'lucide-react';
import { useGetWarrantyQuery, useUpdateWarrantyMutation, useVoidWarrantyMutation } from '@/api/aftercareApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/common/FormDialog';
import { RecordHistory } from '@/components/common/RecordHistory';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { warrantyEditSchema, warrantyVoidSchema } from '@/form/schemas/aftercare.schema';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { certificateUrl, coverLeft } from '@/helpers/aftercare';
import { formatDate, formatDateTime, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const editFields = [
  { name: 'scope', type: 'textarea', label: 'What the warranty covers', rows: 4, maxLength: 2000, placeholder: 'Workmanship warranty for this job' },
  { name: 'endsAt', type: 'date', time: '23:59', label: 'Covered until', required: true, description: 'The last day of cover, in Kathmandu.' },
];
const voidFields = [
  {
    name: 'reason', type: 'textarea', label: 'Why is it void?', required: true, rows: 3, maxLength: 500,
    placeholder: 'e.g. The customer had the work redone by someone else',
    description: 'Kept on the warranty and in the audit log. The certificate then shows it no longer covers the work.',
  },
];

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/**
 * One warranty (Phase I): the job and the customer, the scope and dates, the certificate link the customer was
 * sent (copy / open), and every claim with what became of it — and its History tab (`warranties:read`, like the page). `warranties:write` edits the scope and the end
 * date, and voids it with a reason; a void warranty is read-only.
 */
export default function WarrantyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const { data: warranty, isLoading, error, refetch } = useGetWarrantyQuery(id);
  const [update] = useUpdateWarrantyMutation();
  const [voidIt] = useVoidWarrantyMutation();
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  // Details · History, in the URL (`?tab=history`) like every other record page.
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') === 'history' ? 'history' : 'details';
  const setTab = (next) => setSearch(next === 'details' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const w = warranty;
  const isVoid = w.status === 'VOID';
  const canWrite = can('warranties:write') && !isVoid;
  const left = isVoid ? null : coverLeft(w);
  const link = certificateUrl(w);
  const claims = w.claims ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toastSuccess('Certificate link copied'));
    } catch {
      dispatch(toastError('Could not copy the link', link));
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={`Warranty · ${w.job?.number ?? ''}`}
        description={`${w.job?.title ?? 'Work'} for ${w.customer?.name ?? 'the customer'}${left ? ` — ${left.label.toLowerCase()}` : ''}`}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/warranties')}><ArrowLeft aria-hidden /> Warranties</Button>
            {canWrite ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit</Button> : null}
            {canWrite ? <Button variant="outline" size="sm" onClick={() => setVoiding(true)}><Ban aria-hidden className="text-destructive" /> Void…</Button> : null}
          </div>
        )}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AftercareStatus kind="warranty" status={w.status} />
          {left ? <span className={cn('text-xs', left.soon ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>{left.label}</span> : null}
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Cover</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{w.scope || <span className="text-muted-foreground">Workmanship warranty for this job.</span>}</p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Fact label="From">{formatDate(w.startsAt)}</Fact>
                  <Fact label="Until">{formatDate(w.endsAt)}</Fact>
                </dl>
                {isVoid ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive" data-testid="void-reason">
                    Void{w.voidReason ? `: ${w.voidReason}` : ''}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="h-4 w-4 text-primary" aria-hidden /> Certificate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {link ? (
                  <>
                    <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs" data-testid="certificate-link">{link}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={copy}><Copy aria-hidden /> Copy link</Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> Open certificate</a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">The customer raises a claim from this page — no account needed.</p>
                  </>
                ) : <p className="text-muted-foreground">This warranty has no certificate link.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4 text-primary" aria-hidden /> The work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {can('jobs:read') ? (
                  <Link to={`/admin/jobs/${w.job?.id}`} className="block rounded-md border px-3 py-2 hover:bg-muted">
                    <span className="font-mono text-xs">{w.job?.number}</span> · {w.job?.title}
                  </Link>
                ) : <p><span className="font-mono text-xs">{w.job?.number}</span> · {w.job?.title}</p>}
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Type">{JOB_TYPE_LABELS[w.job?.type] ?? titleCase(w.job?.type ?? '')}</Fact>
                  <Fact label="Completed">{formatDate(w.job?.actualEnd)}</Fact>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Contact className="h-4 w-4 text-primary" aria-hidden /> Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {can('customers:read') ? (
                  <Link to={`/admin/customers/${w.customer?.id}`} className="font-medium hover:underline">{w.customer?.name}</Link>
                ) : <p className="font-medium">{w.customer?.name}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {w.customer?.phone ? (
                    <Button asChild size="sm" variant="outline"><a href={`tel:${w.customer.phone}`}><Phone aria-hidden /> {w.customer.phone}</a></Button>
                  ) : null}
                  {w.customer?.email ? <span className="text-xs text-muted-foreground">{w.customer.email}</span> : null}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4 text-primary" aria-hidden /> Claims ({claims.length})</CardTitle>
                <Button asChild size="sm" variant="ghost"><Link to="/admin/warranty-claims">Claims queue</Link></Button>
              </CardHeader>
              <CardContent>
                {claims.length ? (
                  <ul className="space-y-2" aria-label="Claims on this warranty">
                    {claims.map((c) => (
                      <li key={c.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <AftercareStatus kind="claim" status={c.status} />
                            <span className="text-xs text-muted-foreground">Raised {formatDateTime(c.createdAt)}</span>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/warranty-claims/${c.id}`}>{c.status === 'open' || c.status === 'accepted' ? 'Decide…' : 'Open'}</Link>
                          </Button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap">{c.description}</p>
                        {c.rejectReason ? <p className="mt-1 text-xs text-muted-foreground">Rejected: {c.rejectReason}</p> : null}
                        {c.resolvedJob ? (
                          <p className="mt-1 text-xs">
                            Free warranty job{' '}
                            <Link to={`/admin/jobs/${c.resolvedJob.id}`} className="font-mono text-primary hover:underline">{c.resolvedJob.number}</Link>
                            {' · '}{JOB_STATUS_LABELS[c.resolvedJob.status] ?? titleCase(c.resolvedJob.status ?? '')}
                          </p>
                        ) : null}
                        {c.resolvedAt ? <p className="mt-1 text-xs text-muted-foreground">Resolved {formatDateTime(c.resolvedAt)}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No claims — the customer has not reported a problem.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          {tab === 'history' ? <RecordHistory endpoint={`/admin/warranties/${w.id}/history`} /> : null}
        </TabsContent>
      </Tabs>

      {canWrite ? (
        <ResourceForm
          mode="sheet"
          open={editing}
          onOpenChange={setEditing}
          title={`Edit warranty · ${w.job?.number}`}
          description="The scope and the last day of cover. Its status follows claims and the calendar."
          schema={warrantyEditSchema}
          fields={editFields}
          defaultValues={w}
          guard={false}
          submitLabel="Save"
          onSubmit={async (body) => {
            await update({ id: w.id, ...body }).unwrap();
            dispatch(toastSuccess('Warranty saved'));
            setEditing(false);
          }}
        />
      ) : null}
      {canWrite ? (
        <FormDialog
          open={voiding}
          onOpenChange={setVoiding}
          title={`Void the warranty for ${w.job?.number}?`}
          description="The certificate stops covering the work and no new claim can be raised on it. This cannot be undone here."
          schema={warrantyVoidSchema}
          fields={voidFields}
          defaultValues={{ reason: '' }}
          submitLabel="Void warranty"
          onSubmit={async ({ reason }) => {
            await voidIt({ id: w.id, reason }).unwrap();
            dispatch(toastSuccess('Warranty voided', reason));
          }}
        />
      ) : null}
    </PageTransition>
  );
}
