import { CheckCircle2, XCircle } from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Approve or decline, and the note that travels with either.
 *
 * Three mutually exclusive states, decided by the caller: settled (the answer
 * is already recorded, here or on a previous visit), expired, or open. Approve
 * is the primary action and decline is an outline button beside it — the same
 * weight would make a decision the customer has not made yet look like two
 * equally likely ones.
 */
export function QuotationDecision({
  settled, approved, expired, note, onNote, onDecide, deciding, error,
}) {
  if (settled) {
    return (
      <DocumentNotice
        tone={approved ? 'success' : 'muted'}
        icon={approved ? CheckCircle2 : XCircle}
        title={approved ? 'Thank you — quotation approved' : 'Quotation declined'}
      >
        {approved
          ? 'Our team will call you to schedule the work.'
          : 'We have let our team know. Call us if you would like a revised quote.'}
      </DocumentNotice>
    );
  }

  if (expired) {
    return (
      <DocumentNotice
        tone="warning"
        title="This quotation has expired"
        animate={false}
      >
        Please contact us for an updated one — the rates it was built from may have moved.
      </DocumentNotice>
    );
  }

  return (
    <>
      <Label htmlFor="q-note">Anything you want to add? (optional)</Label>
      <Textarea
        id="q-note" rows={2} className="mt-1.5"
        value={note} onChange={(e) => onNote(e.target.value)}
        placeholder="e.g. Please start after Dashain"
      />

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error?.data?.error?.message ?? 'Could not record your decision.'}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" loading={deciding} onClick={() => onDecide('approve')}>
          <CheckCircle2 className="h-4 w-4" /> Approve this quotation
        </Button>
        <Button size="lg" variant="outline" className="flex-1" disabled={deciding} onClick={() => onDecide('reject')}>
          Decline
        </Button>
      </div>
    </>
  );
}
