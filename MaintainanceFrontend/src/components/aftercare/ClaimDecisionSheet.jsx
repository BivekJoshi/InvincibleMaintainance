import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { z } from 'zod';
import {
  AlertCircle, Briefcase, CalendarDays, CheckCircle2, CircleCheck, Phone, ShieldCheck, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { useDecideWarrantyClaimMutation, useGetWarrantyClaimQuery } from '@/api/aftercareApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { ErrorState } from '@/components/common/ErrorState';
import { AftercareStatus } from '@/components/aftercare/AftercareStatus';
import { ClaimRatePanel } from '@/components/aftercare/ClaimRatePanel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { claimAcceptSchema, claimRejectSchema } from '@/form/schemas/aftercare.schema';
import { CLAIM_STATUS_LABELS, JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '@/config/constants';
import { claimDecisions } from '@/helpers/aftercare';
import { formatDate, formatDateTime, titleCase } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const acceptFields = [
  {
    name: 'scheduledStart', type: 'datetime', label: 'Visit on (optional)', defaultTime: '10:00',
    description: 'Leave it empty and the free job waits, unscheduled and unassigned, in the dispatch queue.',
  },
];
const rejectFields = [
  {
    name: 'rejectReason', type: 'textarea', label: 'Why is it rejected?', required: true, rows: 3, maxLength: 500,
    placeholder: 'e.g. The crack is in a wall we did not work on',
    description: 'The customer is sent this reason by SMS, in their language’s template.',
  },
];
const resolveSchema = z.object({});

const CHOICES = [
  { key: 'accept', label: 'Accept', icon: ThumbsUp },
  { key: 'reject', label: 'Reject', icon: ThumbsDown },
  { key: 'resolve', label: 'Resolve', icon: CircleCheck },
];

/** The API's answer when someone else decided first — anything else is the form's to show. */
const isDecided = (err) => err?.data?.error?.code === 'CLAIM_DECIDED';

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0">{children}</dd>
    </div>
  );
}

/** What became of a decided claim: the free job (and where it waits), the reason, or the date it closed. */
function Outcome({ claim, fresh, canDispatch }) {
  if (claim.status === 'accepted' || (claim.status === 'resolved' && claim.resolvedJob)) {
    const job = claim.resolvedJob;
    return (
      <div role={fresh ? 'status' : undefined} className="space-y-2 rounded-md border surface-success p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {job ? <>Free warranty job <span className="font-mono">{job.number}</span>{fresh ? ' created' : ''}</> : 'Accepted'}
        </p>
        {job ? (
          <>
            <p>
              {JOB_STATUS_LABELS[job.status] ?? titleCase(job.status ?? '')} · not billed.
              {job.status === 'DRAFT' || job.status === 'SCHEDULED'
                ? ' Nobody is on it yet — it waits in the dispatch queue until someone is assigned.'
                : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link to={`/admin/jobs/${job.id}`}><Briefcase aria-hidden /> Open {job.number}</Link></Button>
              {canDispatch ? (
                <Button asChild size="sm" variant="outline"><Link to="/admin/dispatch"><CalendarDays aria-hidden /> Dispatch board</Link></Button>
              ) : null}
            </div>
          </>
        ) : null}
        {claim.status === 'resolved' ? <p className="text-xs">Resolved {formatDateTime(claim.resolvedAt)}.</p> : null}
      </div>
    );
  }
  if (claim.status === 'rejected') {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Rejected</p>
        <p className="mt-1 whitespace-pre-wrap">{claim.rejectReason}</p>
      </div>
    );
  }
  if (claim.status === 'resolved') {
    return <p className="rounded-md border surface-success p-3 text-sm">Resolved {formatDateTime(claim.resolvedAt)}.</p>;
  }
  return null;
}

/**
 * The decision sheet (Phase I, I7): one claim — what the customer wrote, the job and warranty it is on, the claim
 * rate for its work (`reports:ops`) — and, for `warranties:write`, the decision:
 *
 * - **Accept** (an open claim; an optional visit start) → the free WARRANTY job, linked to the original,
 *   unassigned — so it lands in the dispatch queue; the sheet links to it.
 * - **Reject** (an open claim) with a required reason, which the customer is sent.
 * - **Resolve** (an open or accepted claim).
 *
 * Anything else is the API's 422 CLAIM_DECIDED — someone else got there first: the sheet says so and shows the
 * claim as it now stands.
 *
 * @param {{ claimId: string|null, open: boolean, onOpenChange: (open: boolean) => void }} props
 */
export function ClaimDecisionSheet({ claimId, open, onOpenChange }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const { data: claim, isLoading, error, refetch } = useGetWarrantyClaimQuery(claimId, { skip: !claimId });
  const [decide] = useDecideWarrantyClaimMutation();
  const [choice, setChoice] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [fresh, setFresh] = useState(false);

  // A different claim starts clean.
  useEffect(() => { setChoice(null); setConflict(null); setFresh(false); }, [claimId]);

  const allowed = claim ? claimDecisions(claim, can) : { accept: false, reject: false, resolve: false };
  const choices = CHOICES.filter((c) => allowed[c.key]);
  const current = choices.some((c) => c.key === choice) ? choice : choices[0]?.key ?? null;

  const send = async (body, done) => {
    setConflict(null);
    try {
      const result = await decide({ id: claim.id, ...body }).unwrap();
      done(result);
    } catch (err) {
      if (!isDecided(err)) throw err;
      setConflict(err.data.error.message);
      dispatch(toastError('Already decided', err.data.error.message));
      refetch();
    }
  };

  const job = claim?.warranty?.job;
  const customer = claim?.warranty?.customer;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{job ? `Claim on ${job.number}` : 'Warranty claim'}</SheetTitle>
          <SheetDescription>
            {claim ? `${customer?.name ?? 'Customer'} · raised ${formatDateTime(claim.createdAt)}` : 'Loading the claim…'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isLoading ? <Skeleton className="h-48 w-full" /> : null}
          {error ? <ErrorState error={error} onRetry={refetch} /> : null}
          {claim ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <AftercareStatus kind="claim" status={claim.status} />
                {job?.type ? <span className="text-xs text-muted-foreground">{JOB_TYPE_LABELS[job.type] ?? titleCase(job.type)}</span> : null}
              </div>

              <section aria-label="What the customer says">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What the customer says</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{claim.description}</p>
              </section>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Fact label="Original job">
                  {job ? (
                    can('jobs:read')
                      ? <Link to={`/admin/jobs/${job.id}`} className="hover:underline"><span className="font-mono text-xs">{job.number}</span> · {job.title}</Link>
                      : <span><span className="font-mono text-xs">{job.number}</span> · {job.title}</span>
                  ) : '—'}
                </Fact>
                <Fact label="Warranty">
                  <Link to={`/admin/warranties/${claim.warranty?.id}`} className="inline-flex items-center gap-1 hover:underline">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> until {formatDate(claim.warranty?.endsAt)}
                  </Link>
                </Fact>
                <Fact label="Customer">
                  <span className="block truncate">{customer?.name}</span>
                  {customer?.phone ? (
                    <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="h-3 w-3" aria-hidden /> {customer.phone}
                    </a>
                  ) : null}
                </Fact>
              </dl>

              <ClaimRatePanel claim={claim} />

              {conflict ? (
                <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    {conflict} Someone else decided it first — this is where it stands now
                    {claim.status ? ` (${CLAIM_STATUS_LABELS[claim.status] ?? claim.status})` : ''}.
                  </p>
                </div>
              ) : null}

              <Outcome claim={claim} fresh={fresh} canDispatch={can('jobs:dispatch')} />

              {current ? (
                <section aria-label="Decision" className="space-y-3 border-t pt-4">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Decide">
                    {choices.map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={current === key ? 'default' : 'outline'}
                        aria-pressed={current === key}
                        onClick={() => setChoice(key)}
                        className={cn(key === 'reject' && current !== key && 'text-destructive')}
                      >
                        <Icon aria-hidden /> {label}
                      </Button>
                    ))}
                  </div>
                  {current === 'accept' ? (
                    <ResourceForm
                      key={`accept-${claim.id}`}
                      schema={claimAcceptSchema}
                      fields={acceptFields}
                      defaultValues={{}}
                      guard={false}
                      submitLabel="Accept — create the free job"
                      onSubmit={(body) => send({ status: 'accepted', ...body }, (result) => {
                        setFresh(true);
                        dispatch(toastSuccess(
                          `Free job ${result.resolvedJob?.number ?? ''} created`.trim(),
                          'It is unassigned — find it in the dispatch queue.',
                        ));
                      })}
                    />
                  ) : null}
                  {current === 'reject' ? (
                    <ResourceForm
                      key={`reject-${claim.id}`}
                      schema={claimRejectSchema}
                      fields={rejectFields}
                      defaultValues={{ rejectReason: '' }}
                      guard={false}
                      submitLabel="Reject claim"
                      onSubmit={(body) => send({ status: 'rejected', ...body }, () => {
                        dispatch(toastSuccess('Claim rejected', 'The customer is sent the reason.'));
                      })}
                    />
                  ) : null}
                  {current === 'resolve' ? (
                    <ResourceForm
                      key={`resolve-${claim.id}`}
                      schema={resolveSchema}
                      fields={[]}
                      defaultValues={{}}
                      guard={false}
                      intro={(
                        <p className="text-sm text-muted-foreground">
                          {claim.status === 'accepted'
                            ? 'The rework is done: close the claim. The warranty covers the work again.'
                            : 'Close the claim without a job — sorted on the phone, or the customer withdrew it.'}
                        </p>
                      )}
                      submitLabel="Mark resolved"
                      onSubmit={() => send({ status: 'resolved' }, () => dispatch(toastSuccess('Claim resolved')))}
                    />
                  ) : null}
                </section>
              ) : null}
              {!can('warranties:write') ? (
                <p className="text-xs text-muted-foreground">Dispatch decides claims; you can read them.</p>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
