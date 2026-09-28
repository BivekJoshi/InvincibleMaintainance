import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { HeartHandshake } from 'lucide-react';
import { useOfferAmcMutation } from '@/api/jobsApi';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { apiRefusal } from '@/helpers/closeout';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/**
 * **Offer AMC** (Phase L8) — at handover, a lead for sales to offer the customer a yearly maintenance contract:
 * `POST /admin/jobs/:id/offer-amc` (`jobs:write`) makes it (source "AMC offer", the customer and the site's address,
 * owned by whoever sold the job). When the customer already has an open AMC offer the server answers with that one —
 * said so, never a second lead. The result links the lead for `leads:read`. Shown on the handover dialog and on a
 * finished job's Overview.
 *
 * @param {{ job: { id: string, number: string, customer?: { name?: string } } }} props
 */
export function OfferAmcButton({ job }) {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [offer, { isLoading }] = useOfferAmcMutation();
  const [result, setResult] = useState(null);
  if (!can('jobs:write')) return null;

  const run = async () => {
    try {
      const answer = await offer({ id: job.id }).unwrap();
      setResult(answer);
      dispatch(answer.existing
        ? toastSuccess('An AMC offer is already open', `${answer.lead?.name ?? job.customer?.name ?? 'The customer'} is with sales already.`)
        : toastSuccess('AMC offer sent to sales', `A lead for ${answer.lead?.name ?? job.customer?.name ?? 'the customer'} is waiting for a call.`));
    } catch (err) {
      dispatch(toastError('Could not offer an AMC', apiRefusal(err)?.message));
    }
  };

  if (result) {
    const lead = result.lead ?? {};
    const owner = lead.assignedTo?.name;
    return (
      <p role="status" className="surface-success rounded-md border px-3 py-2 text-sm" data-testid="amc-offered">
        {result.existing
          ? 'This customer already has an open AMC offer with sales'
          : 'A lead is with sales to offer the maintenance contract'}
        {owner ? ` — ${owner}` : ''}.
        {can('leads:read') && lead.id ? (
          <> <Link to={`/admin/leads/${lead.id}`} className="font-medium underline underline-offset-2">Open the lead</Link></>
        ) : null}
      </p>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={run} disabled={isLoading} data-testid="offer-amc">
      <HeartHandshake aria-hidden /> Offer AMC
    </Button>
  );
}
