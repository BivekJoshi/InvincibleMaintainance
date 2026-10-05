import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAddJobTaskMutation, useCompleteJobMutation, useGetJobQuery } from '@/api/jobsApi';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { jobHandoverSchema } from '@/form/schemas/job.schema';
import { certificateUrl } from '@/helpers/aftercare';
import { apiRefusal } from '@/helpers/closeout';
import { formatDateAdBs } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { OfferAmcButton } from './OfferAmcButton';

const RATINGS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})` }));

/** The snags typed, blanks left out — the ones that become checklist items. */
const snagsOf = (values) => (Array.isArray(values?.snags) ? values.snags.map((s) => String(s ?? '').trim()).filter(Boolean) : []);

/** A sign-off field stays out of sight while there are snags: the job is not being completed yet. */
const hiddenWithSnags = (values) => (snagsOf(values).length ? { hidden: true } : undefined);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The **handover** (Phase L8) — what "Complete" opens, from the job page's bar and the jobs list. Once the job is done:
 *
 * 1. **Snags** — anything still to put right. Each becomes a checklist item (`POST /admin/jobs/:id/tasks`) and, since
 *    an open item blocks completion (the API refuses with the open items), the dialog then closes **without**
 *    completing: the job is completed when they are done or skipped. It says so up front.
 * 2. With no snags, the sign-off (Phase H1's): what was done, the signature photo, rating, feedback, the warranty's days
 *    and scope — `POST /admin/jobs/:id/complete`, which issues the warranty (not for an inspection) and tells the
 *    customer.
 * 3. Then the handover itself: the **warranty** — the job detail's `warranty`, its cover and its certificate link
 *    (`/warranty/:token`, Copy / Open) — and **Offer AMC** (`OfferAmcButton`), a lead for sales.
 *
 * @param {{ job: object|null, onOpenChange: (open: boolean) => void }} props
 */
export function CompleteJobDialog({ job, onOpenChange }) {
  return (
    <Dialog open={Boolean(job)} onOpenChange={onOpenChange}>
      {job ? <Handover key={job.id} job={job} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function Handover({ job, onOpenChange }) {
  const dispatch = useDispatch();
  const [complete] = useCompleteJobMutation();
  const [addTask] = useAddJobTaskMutation();
  const [values, setValues] = useState(null);
  const [completed, setCompleted] = useState(false);
  const inspection = job.type === 'INSPECTION';
  const snags = snagsOf(values);

  const fields = [
    {
      name: 'snags', type: 'stringList', label: 'Snags — anything still to put right', addLabel: 'Add a snag', maxItems: 20,
      placeholder: 'Touch up the paint by the balcony door',
      description: 'Each snag becomes a checklist item. An open item blocks completion, so the job stays open until they are done or skipped.',
    },
    { name: 'note', type: 'textarea', label: 'What was done', rows: 3, adapt: hiddenWithSnags },
    {
      name: 'signatureMediaId', type: 'media', label: 'Customer’s signature', description: 'A photo of the signed job sheet, if there is one.',
      adapt: hiddenWithSnags,
    },
    { name: 'customerRating', type: 'select', label: 'Customer’s rating', span: 'half', options: RATINGS, noneLabel: 'Not given', adapt: hiddenWithSnags },
    ...(inspection ? [] : [{
      name: 'warrantyDays', type: 'number', label: 'Warranty (days)', span: 'half', min: 0, max: 3650, step: 1,
      description: 'Leave empty for the usual period. 0 = no warranty.', adapt: hiddenWithSnags,
    }]),
    { name: 'customerFeedback', type: 'textarea', label: 'What the customer said', rows: 2, adapt: hiddenWithSnags },
    ...(inspection ? [] : [{
      name: 'warrantyScope', type: 'textarea', label: 'What the warranty covers', rows: 2, placeholder: 'Workmanship warranty for this job',
      adapt: hiddenWithSnags,
    }]),
  ];

  /** Snags → checklist items, one by one; a failure part-way says how many went in. */
  const recordSnags = async (list) => {
    let added = 0;
    try {
      for (const title of list) {
        await addTask({ id: job.id, title }).unwrap();
        added += 1;
      }
    } catch (err) {
      if (!added) throw err;
      dispatch(toastError(`Only ${added} of ${list.length} snags were added`, `${apiRefusal(err)?.message ?? ''} Add the rest on the Checklist tab.`.trim()));
      onOpenChange(false);
      return;
    }
    dispatch(toastSuccess(
      `${plural(added, 'snag', 'snags')} added to ${job.number}’s checklist`,
      'Complete the job once they are done or skipped.',
    ));
    onOpenChange(false);
  };

  const submit = async (body) => {
    const list = body.snags ?? [];
    if (list.length) {
      await recordSnags(list);
      return;
    }
    // What was left empty is not sent: an empty scope would replace the warranty's default wording with nothing.
    const { snags: _none, ...rest } = body;
    const signOff = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    await complete({ id: job.id, ...signOff }).unwrap();
    dispatch(toastSuccess(`${job.number} completed`, inspection ? undefined : 'The warranty is issued and the customer has been told.'));
    setCompleted(true);
  };

  if (completed) {
    return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{`${job.number} is handed over`}</DialogTitle>
          <DialogDescription>The job is complete. Share the warranty with the customer, and offer a maintenance contract.</DialogDescription>
        </DialogHeader>
        <HandedOver job={job} />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{`Hand over ${job.number}`}</DialogTitle>
        <DialogDescription>
          Every checklist item must be done or skipped first. Anything still to put right? Add it as a snag — the job then
          stays open until it is done.
        </DialogDescription>
      </DialogHeader>
      <ResourceForm
        schema={jobHandoverSchema}
        fields={fields}
        defaultValues={{ snags: [] }}
        guard={false}
        onValuesChange={setValues}
        submitLabel={snags.length ? `Add ${plural(snags.length, 'snag', 'snags')} to the checklist` : 'Complete and hand over'}
        onCancel={() => onOpenChange(false)}
        onSubmit={submit}
      />
    </DialogContent>
  );
}

/** After completion: the warranty with its certificate link, and Offer AMC. */
function HandedOver({ job }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  // Completion invalidated the job, so this is the detail with the warranty completion issued.
  const { data: fresh, isFetching } = useGetJobQuery(job.id);
  const inspection = job.type === 'INSPECTION';
  const warranty = fresh?.warranty ?? null;
  const link = certificateUrl(warranty);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toastSuccess('Warranty link copied'));
    } catch {
      dispatch(toastError('Could not copy the link', link));
    }
  };

  return (
    <div className="space-y-5 text-sm" data-testid="handover-done">
      <p className="flex items-center gap-2 font-medium text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {job.number} is complete.
      </p>

      {inspection ? null : (
        <section aria-labelledby="handover-warranty" className="space-y-2" data-testid="handover-warranty">
          <h3 id="handover-warranty" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Warranty
          </h3>
          {!warranty && (isFetching || !fresh) ? <Skeleton className="h-16 w-full" /> : null}
          {warranty ? (
            <>
              {warranty.scope ? <p>{warranty.scope}</p> : null}
              <p className="tabular-nums text-muted-foreground">Covered until {formatDateAdBs(warranty.endsAt)}</p>
              {link ? (
                <>
                  <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs" data-testid="warranty-link">{link}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={copyLink}><Copy aria-hidden /> Copy</Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> Open the certificate</a>
                    </Button>
                    {can('warranties:read') && warranty.id ? (
                      <Button size="sm" variant="ghost" asChild><Link to={`/admin/warranties/${warranty.id}`}>Warranty record</Link></Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : fresh && !isFetching ? <p className="text-muted-foreground">No warranty was issued for this job.</p> : null}
        </section>
      )}

      {inspection ? null : (
        <section aria-labelledby="handover-amc" className="space-y-2">
          <h3 id="handover-amc" className="font-semibold">Maintenance contract</h3>
          <p className="text-muted-foreground">Sales can offer {job.customer?.name ?? 'the customer'} a yearly maintenance contract for this site.</p>
          <OfferAmcButton job={job} />
        </section>
      )}
    </div>
  );
}
