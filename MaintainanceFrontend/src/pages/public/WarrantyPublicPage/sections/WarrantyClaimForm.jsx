import { CheckCircle2 } from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/** Below this, a description is not enough for a technician to act on. */
const MIN_DESCRIPTION = 10;

/**
 * The button that makes the one-month promise real: a claim here creates a free
 * rework job on the operations board, at high priority.
 *
 * Three states, in the order a customer meets them: a claim already open (or
 * just filed), cover still live, or cover expired — and the expired case still
 * gives them a number to call rather than a dead end.
 */
export function WarrantyClaimForm({
  isValid, hasOpenClaim, description, onDescription, onSubmit, claiming, error, phone,
}) {
  if (hasOpenClaim) {
    return (
      <DocumentNotice tone="success" icon={CheckCircle2} title="Your claim is with our team">
        We will call you to arrange a visit. There is no charge for warranty work.
      </DocumentNotice>
    );
  }

  if (!isValid) {
    return (
      <DocumentNotice tone="muted" title="This warranty has expired" animate={false}>
        We can still help — call us on {phone} and we will quote the repair.
      </DocumentNotice>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 className="font-semibold">Something wrong with this work?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us what happened. A valid claim is attended free of charge, at high priority.
      </p>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="claim" required>What is the problem?</Label>
        <Textarea
          id="claim" rows={4} required minLength={MIN_DESCRIPTION}
          value={description} onChange={(e) => onDescription(e.target.value)}
          placeholder="Describe what you are seeing, and where."
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error?.data?.error?.message ?? 'Could not submit your claim.'}
        </p>
      ) : null}

      <Button
        type="submit"
        className="mt-4 w-full"
        loading={claiming}
        disabled={description.trim().length < MIN_DESCRIPTION}
      >
        Raise a warranty claim
      </Button>
    </form>
  );
}
