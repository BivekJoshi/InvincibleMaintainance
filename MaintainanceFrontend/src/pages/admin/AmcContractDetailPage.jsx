import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft, Ban, CalendarClock, Contact, Pencil, Phone, RefreshCw, RotateCcw, ScrollText, Trash2,
} from 'lucide-react';
import {
  useDeleteAmcContractMutation, useGetAmcContractQuery, useUpdateAmcContractMutation,
} from '@/api/aftercareApi';
import { useGetCustomerSitesQuery } from '@/api/customersApi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { StateBadge } from '@/components/common/StateBadge';
import { RecordHistory } from '@/components/common/RecordHistory';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { AmcContractSheet } from '@/components/aftercare/AmcContractSheet';
import { amcPlanFields } from '@/config/admin/aftercareForms';
import { useServiceNames } from '@/hooks/useServiceNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { amcContractEditSchema } from '@/form/schemas/aftercare.schema';
import { RENEWALS_DAYS } from '@/config/admin/aftercareViews';
import { AMC_BILLING_CYCLE_LABELS, JOB_STATUS_LABELS } from '@/config/constants';
import { contractEndsIn, matchServices, renewalDefaults } from '@/helpers/aftercare';
import { formatDate, formatDateTime, formatNpr, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

const visitColumns = [
  { key: 'n', header: '#', cell: (r) => <span className="tabular-nums text-muted-foreground">{r.n}</span> },
  { key: 'dueDate', header: 'Due', cell: (r) => <span className="whitespace-nowrap">{formatDate(r.dueDate)}</span> },
  { key: 'status', header: 'Status', cell: (r) => <AftercareStatus kind="visit" status={r.status} /> },
  {
    key: 'job', header: 'Job',
    cell: (r) => (r.job ? (
      <div className="min-w-0">
        <Link to={`/admin/jobs/${r.job.id}`} className="font-mono text-xs text-primary hover:underline">{r.job.number}</Link>
        <p className="text-xs text-muted-foreground">
          {JOB_STATUS_LABELS[r.job.status] ?? titleCase(r.job.status ?? '')}
          {r.job.scheduledStart ? ` · ${formatDateTime(r.job.scheduledStart)}` : ''}
        </p>
      </div>
    ) : <span className="text-xs text-muted-foreground">Made a week before it is due</span>),
    exportValue: (r) => r.job?.number ?? '',
  },
  { key: 'note', header: 'Note', cell: (r) => <span className="text-xs">{r.note ?? ''}</span> },
];

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/**
 * One AMC contract (Phase I, I8): the customer and site, the plan (covered services, amount — the server's
 * paisa — and billing cycle), the term, and every visit with its due date, state and the job made for it.
 * `amc:write` edits the plan (never the schedule: a new schedule is a renewal), **renews** it — the create sheet
 * prefilled, starting the day after this one ends — cancels or reactivates it, or removes it. The History tab is the
 * contract's audit trail (`amc:read`, like the page).
 */
export default function AmcContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('amc:write');
  const { data: contract, isLoading, error, refetch } = useGetAmcContractQuery(id);
  const [update] = useUpdateAmcContractMutation();
  const [remove] = useDeleteAmcContractMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const customerId = contract?.customer?.id ?? contract?.customerId;
  const { data: sites } = useGetCustomerSitesQuery(customerId, { skip: !editing || !customerId });
  const services = useServiceNames(editing);
  const [visitParams, setVisitParams] = useState({});
  // Details · History, in the URL (`?tab=history`) like every other record page.
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') === 'history' ? 'history' : 'details';
  const setTab = (next) => setSearch(next === 'details' ? {} : { tab: next }, { replace: true });

  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;
  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;

  const c = contract;
  const visits = (c.visits ?? []).map((v, i) => ({ ...v, n: i + 1 }));
  const done = visits.filter((v) => v.status === 'completed').length;
  const endsIn = contractEndsIn(c, RENEWALS_DAYS);

  const setStatus = async (status) => {
    const cancelling = status === 'cancelled';
    const ok = await confirm(cancelling ? {
      title: `Cancel ${c.number}?`,
      description: 'No more visit jobs are made for it. Visits already booked stay on the board.',
      confirmLabel: 'Cancel contract', cancelLabel: 'Keep it', destructive: true,
    } : {
      title: `Reactivate ${c.number}?`,
      description: 'Its remaining visits get jobs again, a week before each is due.',
      confirmLabel: 'Reactivate',
    });
    if (!ok) return;
    try {
      await update({ id: c.id, status }).unwrap();
      dispatch(toastSuccess(cancelling ? `${c.number} cancelled` : `${c.number} is active again`));
    } catch (err) {
      dispatch(toastError('Could not change the contract', err?.data?.error?.message));
    }
  };

  const onRemove = async () => {
    const ok = await confirm({
      title: `Remove ${c.number}?`,
      description: 'For a contract made by mistake: it disappears from every list. Jobs already made for its visits stay.',
      confirmLabel: 'Remove contract', destructive: true,
    });
    if (!ok) return;
    try {
      await remove(c.id).unwrap();
      dispatch(toastSuccess(`${c.number} removed`));
      navigate('/admin/amc-contracts', { replace: true });
    } catch (err) {
      dispatch(toastError('Could not remove the contract', err?.data?.error?.message));
    }
  };

  const editFields = amcPlanFields({ customerId, sites: sites ?? [], services });

  return (
    <PageTransition>
      <PageHeader
        title={`${c.number} · ${c.planName}`}
        description={`${c.customer?.name ?? 'Customer'} — ${formatDate(c.startDate)} to ${formatDate(c.endDate)}`}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/amc-contracts')}><ArrowLeft aria-hidden /> Contracts</Button>
            {canWrite ? <Button size="sm" onClick={() => setRenewing(true)}><RefreshCw aria-hidden /> Renew…</Button> : null}
            {canWrite && c.status !== 'cancelled' ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit</Button> : null}
            {canWrite && c.status === 'active' ? (
              <Button size="sm" variant="outline" onClick={() => setStatus('cancelled')}><Ban aria-hidden className="text-destructive" /> Cancel…</Button>
            ) : null}
            {canWrite && c.status === 'cancelled' ? (
              <Button size="sm" variant="outline" onClick={() => setStatus('active')}><RotateCcw aria-hidden /> Reactivate…</Button>
            ) : null}
            {canWrite ? (
              <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remove contract"><Trash2 className="text-destructive" /></Button>
            ) : null}
          </div>
        )}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AftercareStatus kind="amc" status={c.status} />
          {endsIn ? <StateBadge tone="warning">{endsIn} — renew?</StateBadge> : null}
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Contact className="h-4 w-4 text-primary" aria-hidden /> Customer and site</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {can('customers:read') ? (
                  <Link to={`/admin/customers/${customerId}`} className="font-medium hover:underline">{c.customer?.name}</Link>
                ) : <p className="font-medium">{c.customer?.name}</p>}
                {c.customer?.phone ? (
                  <Button asChild size="sm" variant="outline"><a href={`tel:${c.customer.phone}`}><Phone aria-hidden /> {c.customer.phone}</a></Button>
                ) : null}
                {c.site ? (
                  <div className="rounded-md border p-2">
                    <p className="font-medium">{c.site.label}</p>
                    <p className="text-muted-foreground">{c.site.address}</p>
                  </div>
                ) : <p className="text-muted-foreground">No particular site.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-primary" aria-hidden /> Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Amount"><span className="font-semibold tabular-nums" data-testid="amc-amount">{formatNpr(c.amount)}</span></Fact>
                  <Fact label="Billed">{AMC_BILLING_CYCLE_LABELS[c.billingCycle] ?? titleCase(c.billingCycle ?? '')}</Fact>
                </dl>
                {c.coveredServices?.length ? (
                  <div className="flex flex-wrap gap-1.5" aria-label="Covered services">
                    {c.coveredServices.map((s) => <StateBadge key={s} tone="info">{titleCase(s)}</StateBadge>)}
                  </div>
                ) : <p className="text-muted-foreground">No services listed.</p>}
                {c.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" aria-hidden /> Term</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Fact label="Starts">{formatDate(c.startDate)}</Fact>
                  <Fact label="Ends">{formatDate(c.endDate)}</Fact>
                  <Fact label="Visits a year">{c.visitsPerYear}</Fact>
                  <Fact label="Visits done">{done} of {visits.length}</Fact>
                </dl>
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="amc-visits" className="mt-6 space-y-2">
            <h2 id="amc-visits" className="text-base font-semibold">Visits</h2>
            <CustomTable
              columns={visitColumns}
              data={visits}
              meta={{ page: 1, pages: 1, total: visits.length, limit: visits.length || 1 }}
              params={visitParams}
              onParamsChange={setVisitParams}
              searchable={false}
              pageSizes={[]}
              rowLabel={(r) => `Visit ${r.n}, due ${formatDate(r.dueDate)}`}
              emptyTitle="No visits"
            />
          </section>
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          {tab === 'history' ? <RecordHistory endpoint={`/admin/amc-contracts/${c.id}/history`} /> : null}
        </TabsContent>
      </Tabs>

      {canWrite && editing ? (
        <ResourceForm
          mode="sheet"
          open
          onOpenChange={setEditing}
          title={`Edit ${c.number}`}
          description="The plan, price and site. The dates and visits are set — renew for a new schedule."
          schema={amcContractEditSchema}
          fields={editFields}
          defaultValues={{ ...c, siteId: c.site?.id ?? c.siteId ?? null, coveredServices: matchServices(c.coveredServices, services) }}
          guard={false}
          submitLabel="Save"
          onSubmit={async (body) => {
            await update({ id: c.id, ...body }).unwrap();
            dispatch(toastSuccess(`${c.number} saved`));
            setEditing(false);
          }}
        />
      ) : null}
      {canWrite && renewing ? (
        <AmcContractSheet
          open
          onOpenChange={setRenewing}
          defaults={renewalDefaults(c)}
          title={`Renew ${c.number}`}
          description={`A new contract, starting ${formatDate(renewalDefaults(c).startDate)} — the day after this one ends.`}
          onCreated={(next) => navigate(`/admin/amc-contracts/${next.id}`)}
        />
      ) : null}
      {confirmDialog}
    </PageTransition>
  );
}
