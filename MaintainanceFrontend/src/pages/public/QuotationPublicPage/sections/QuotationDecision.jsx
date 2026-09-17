import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, FileClock, MessageSquareText, Phone, RefreshCw, XCircle,
} from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useZodForm } from '@/form/useZodForm';
import { quotationChangeRequestSchema, quotationDeclineSchema } from '@/form/schemas/quotation.schema';
import { QUOTATION_PAGE_COPY as COPY } from '../quotationPageCopy';

/**
 * The customer's answer, and what happens next.
 *
 * `state` comes from `quotationPageState`. While the quotation is open, three large
 * buttons — Accept is the primary one, because it is the answer the page exists for —
 * each open one confirm step: Accept repeats the total, Ask for changes takes a message,
 * Decline an optional reason. No login, no code, no name.
 *
 * @param {{ state: { kind: string, actions: string[], replacedToken?: string }, quotation: object,
 *   total: string, phone?: string, onAnswer: (decision: string, note?: string) => Promise<void>,
 *   answering: boolean, error?: string|null, clearError: () => void }} props
 */
export function QuotationDecision(props) {
  const { state, error } = props;
  // An answer that arrived too late (expired, replaced, answered elsewhere) says so above what the page shows now.
  return (
    <>
      {error && state.kind !== 'open' ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      <DecisionBody {...props} />
    </>
  );
}

function DecisionBody({
  state, quotation, total, phone, onAnswer, answering, error, clearError,
}) {
  const [asking, setAsking] = useState(null); // 'approve' | 'request_changes' | 'reject'

  const open = (kind) => { clearError(); setAsking(kind); };
  const close = (isOpen) => { if (!isOpen && !answering) setAsking(null); };
  const answer = async (decision, note) => {
    const ok = await onAnswer(decision, note);
    if (ok) setAsking(null);
  };

  switch (state.kind) {
    case 'accepted':
      return (
        <DocumentNotice tone="success" icon={CheckCircle2} title={COPY.outcome.accepted.title}>
          {COPY.outcome.accepted.body}
          {quotation.job?.number ? ` ${COPY.outcome.accepted.job(quotation.job.number)}` : ''}
        </DocumentNotice>
      );
    case 'changes':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={MessageSquareText} title={COPY.outcome.changes.title}>
            {COPY.outcome.changes.body}
          </DocumentNotice>
          {quotation.decisionNote ? (
            <div className="rounded-lg bg-muted/60 p-4 text-sm">
              <p className="font-medium">{COPY.outcome.changes.yours}</p>
              <p className="mt-1 whitespace-pre-wrap" lang="ne">{quotation.decisionNote}</p>
            </div>
          ) : null}
        </div>
      );
    case 'declined':
      return <DocumentNotice tone="muted" icon={XCircle} title={COPY.outcome.declined.title}>{COPY.outcome.declined.body}</DocumentNotice>;
    case 'expired':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="warning" icon={Clock} title={COPY.outcome.expired.title} animate={false}>
            {COPY.outcome.expired.body}
          </DocumentNotice>
          {phone ? (
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={`tel:${phone}`}><Phone aria-hidden /> {COPY.outcome.expired.call(phone)}</a>
            </Button>
          ) : null}
        </div>
      );
    case 'replaced':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={RefreshCw} title={COPY.outcome.replaced.title} animate={false}>
            {COPY.outcome.replaced.body}
          </DocumentNotice>
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link to={`/quotation/${state.replacedToken}`}>{COPY.outcome.replaced.open}</Link>
          </Button>
        </div>
      );
    case 'replacedPending':
      return <DocumentNotice tone="muted" icon={FileClock} title={COPY.outcome.replacedPending.title} animate={false}>{COPY.outcome.replacedPending.body}</DocumentNotice>;
    case 'open':
      break;
    default:
      return <DocumentNotice tone="muted" title={COPY.outcome.closed.title} animate={false}>{COPY.outcome.closed.body}</DocumentNotice>;
  }

  const has = (a) => state.actions.includes(a);

  return (
    <section aria-labelledby="q-answer">
      <h2 id="q-answer" className="text-lg font-semibold">{COPY.prompt.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{COPY.prompt.body}</p>

      {error && !asking ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {has('approve') ? (
          <Button size="lg" className="h-14 text-base" onClick={() => open('approve')}>
            <CheckCircle2 aria-hidden /> {COPY.buttons.accept}
          </Button>
        ) : null}
        {has('request_changes') ? (
          <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => open('request_changes')}>
            <MessageSquareText aria-hidden /> {COPY.buttons.changes}
          </Button>
        ) : null}
        {has('reject') ? (
          <Button size="lg" variant="ghost" className="h-14 text-base" onClick={() => open('reject')}>
            <XCircle aria-hidden /> {COPY.buttons.decline}
          </Button>
        ) : null}
      </div>

      <Dialog open={asking === 'approve'} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{COPY.accept.title}</DialogTitle>
            <DialogDescription>{COPY.accept.body(total)}</DialogDescription>
          </DialogHeader>
          <p className="text-center text-3xl font-bold tabular-nums" data-testid="accept-total">{total}</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="lg" onClick={() => close(false)} disabled={answering}>{COPY.accept.cancel}</Button>
            <Button size="lg" loading={answering} onClick={() => answer('approve')}>{COPY.accept.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NoteDialog
        open={asking === 'request_changes'}
        onOpenChange={close}
        copy={COPY.changes}
        schema={quotationChangeRequestSchema}
        required
        answering={answering}
        error={error}
        onSubmit={(note) => answer('request_changes', note)}
      />
      <NoteDialog
        open={asking === 'reject'}
        onOpenChange={close}
        copy={COPY.decline}
        schema={quotationDeclineSchema}
        answering={answering}
        error={error}
        destructive
        onSubmit={(note) => answer('reject', note || undefined)}
      />
    </section>
  );
}

function NoteDialog({ open, onOpenChange, copy, schema, required, answering, error, destructive, onSubmit }) {
  const form = useZodForm(schema, { defaultValues: { note: '' } });
  const { register, handleSubmit, formState: { errors } } = form;
  const id = required ? 'q-changes' : 'q-decline';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(({ note }) => onSubmit(note))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={id} required={required}>{copy.label}</Label>
            <Textarea
              id={id}
              rows={4}
              lang="ne"
              maxLength={1000}
              placeholder={copy.placeholder}
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={errors.note ? `${id}-error` : undefined}
              {...register('note')}
            />
            {errors.note ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{errors.note.message}</p> : null}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={answering}>{copy.cancel}</Button>
            <Button type="submit" size="lg" variant={destructive ? 'destructive' : 'default'} loading={answering}>{copy.confirm}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
