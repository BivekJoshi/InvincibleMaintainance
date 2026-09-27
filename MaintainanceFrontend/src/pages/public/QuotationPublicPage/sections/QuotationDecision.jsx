import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import {
  CheckCircle2, Clock, FileClock, MessageSquareText, Phone, RefreshCw, XCircle,
} from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useZodForm } from '@/form/useZodForm';
import { changeRequestSchema, declineSchema } from '@/form/schemas/quotation.schema';
import { DECLINE_CATEGORIES } from '@/config/constants';

/**
 * The customer's answer, and what happens next — in the page's language (`copy`, from `quotationPageCopy.js`).
 *
 * `state` comes from `quotationPageState`. While the quotation is open, three large
 * buttons — Accept is the primary one, because it is the answer the page exists for —
 * each open one confirm step: Accept repeats the total, Ask for changes takes a message,
 * Decline offers reason chips (Phase L4 — a lost category, sent as `category`) and an
 * optional note. No login, no code, no name.
 *
 * @param {{ state: { kind: string, actions: string[], replacedToken?: string }, quotation: object,
 *   total: string, phone?: string, copy: object,
 *   onAnswer: (decision: string, extra?: { note?: string, category?: string }) => Promise<boolean>,
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
  state, quotation, total, phone, copy, onAnswer, answering, error, clearError,
}) {
  const [asking, setAsking] = useState(null); // 'approve' | 'request_changes' | 'reject'

  const open = (kind) => { clearError(); setAsking(kind); };
  const close = (isOpen) => { if (!isOpen && !answering) setAsking(null); };
  const answer = async (decision, extra) => {
    const ok = await onAnswer(decision, extra);
    if (ok) setAsking(null);
  };

  switch (state.kind) {
    case 'accepted':
      return (
        <DocumentNotice tone="success" icon={CheckCircle2} title={copy.outcome.accepted.title}>
          {copy.outcome.accepted.body}
          {quotation.job?.number ? ` ${copy.outcome.accepted.job(quotation.job.number)}` : ''}
        </DocumentNotice>
      );
    case 'changes':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={MessageSquareText} title={copy.outcome.changes.title}>
            {copy.outcome.changes.body}
          </DocumentNotice>
          {quotation.decisionNote ? (
            <div className="rounded-lg bg-muted/60 p-4 text-sm">
              <p className="font-medium">{copy.outcome.changes.yours}</p>
              <p className="mt-1 whitespace-pre-wrap" lang="ne">{quotation.decisionNote}</p>
            </div>
          ) : null}
        </div>
      );
    case 'declined':
      return <DocumentNotice tone="muted" icon={XCircle} title={copy.outcome.declined.title}>{copy.outcome.declined.body}</DocumentNotice>;
    case 'expired':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="warning" icon={Clock} title={copy.outcome.expired.title} animate={false}>
            {copy.outcome.expired.body}
          </DocumentNotice>
          {phone ? (
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={`tel:${phone}`}><Phone aria-hidden /> {copy.outcome.expired.call(phone)}</a>
            </Button>
          ) : null}
        </div>
      );
    case 'replaced':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={RefreshCw} title={copy.outcome.replaced.title} animate={false}>
            {copy.outcome.replaced.body}
          </DocumentNotice>
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link to={`/quotation/${state.replacedToken}`}>{copy.outcome.replaced.open}</Link>
          </Button>
        </div>
      );
    case 'replacedPending':
      return <DocumentNotice tone="muted" icon={FileClock} title={copy.outcome.replacedPending.title} animate={false}>{copy.outcome.replacedPending.body}</DocumentNotice>;
    case 'open':
      break;
    default:
      return <DocumentNotice tone="muted" title={copy.outcome.closed.title} animate={false}>{copy.outcome.closed.body}</DocumentNotice>;
  }

  const has = (a) => state.actions.includes(a);

  return (
    <section aria-labelledby="q-answer">
      <h2 id="q-answer" className="text-lg font-semibold">{copy.prompt.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.prompt.body}</p>

      {error && !asking ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {has('approve') ? (
          <Button size="lg" className="h-14 whitespace-normal text-base" onClick={() => open('approve')}>
            <CheckCircle2 aria-hidden /> {copy.buttons.accept}
          </Button>
        ) : null}
        {has('request_changes') ? (
          <Button size="lg" variant="outline" className="h-14 whitespace-normal text-base" onClick={() => open('request_changes')}>
            <MessageSquareText aria-hidden /> {copy.buttons.changes}
          </Button>
        ) : null}
        {has('reject') ? (
          <Button size="lg" variant="ghost" className="h-14 whitespace-normal text-base" onClick={() => open('reject')}>
            <XCircle aria-hidden /> {copy.buttons.decline}
          </Button>
        ) : null}
      </div>

      <Dialog open={asking === 'approve'} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.accept.title}</DialogTitle>
            <DialogDescription>{copy.accept.body(total)}</DialogDescription>
          </DialogHeader>
          <p className="text-center text-3xl font-bold tabular-nums" data-testid="accept-total">{total}</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="lg" onClick={() => close(false)} disabled={answering}>{copy.accept.cancel}</Button>
            <Button size="lg" loading={answering} onClick={() => answer('approve')}>{copy.accept.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangesDialog
        open={asking === 'request_changes'}
        onOpenChange={close}
        copy={copy.changes}
        answering={answering}
        error={error}
        onSubmit={(note) => answer('request_changes', { note })}
      />
      <DeclineDialog
        open={asking === 'reject'}
        onOpenChange={close}
        copy={copy.decline}
        reasons={copy.declineReasons}
        answering={answering}
        error={error}
        onSubmit={({ note, category }) => answer('reject', { note: note || undefined, category: category || undefined })}
      />
    </section>
  );
}

/** The message box both dialogs share. */
function NoteBox({ id, label, placeholder, required, register, error }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>{label}</Label>
      <Textarea
        id={id}
        rows={4}
        lang="ne"
        maxLength={1000}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...register('note')}
      />
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error.message}</p> : null}
    </div>
  );
}

function ChangesDialog({ open, onOpenChange, copy, answering, error, onSubmit }) {
  const schema = useMemo(() => changeRequestSchema({ tooShort: copy.tooShort, tooLong: copy.tooLong }), [copy]);
  const { register, handleSubmit, formState: { errors } } = useZodForm(schema, { defaultValues: { note: '' } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(({ note }) => onSubmit(note))} className="space-y-4">
          <NoteBox id="q-changes" label={copy.label} placeholder={copy.placeholder} required register={register} error={errors.note} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={answering}>{copy.cancel}</Button>
            <Button type="submit" size="lg" loading={answering}>{copy.confirm}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Decline: reason chips (one, optional — `DECLINE_CATEGORIES`, the lost categories a customer would recognise)
 * and an optional note. The chosen chip is sent as `category`; the office's "Mark lost?" prompt starts from it.
 */
function DeclineDialog({ open, onOpenChange, copy, reasons, answering, error, onSubmit }) {
  const schema = useMemo(() => declineSchema({ tooLong: copy.tooLong }), [copy]);
  const { register, control, handleSubmit, formState: { errors } } = useZodForm(schema, { defaultValues: { note: '', category: null } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <p id="q-decline-reasons" className="text-sm font-medium">{copy.reasons}</p>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v || null)}
                  aria-labelledby="q-decline-reasons"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {DECLINE_CATEGORIES.map((c) => (
                    <ToggleGroupItem
                      key={c}
                      value={c}
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 rounded-full px-3 py-1.5 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {reasons[c]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </div>
          <NoteBox id="q-decline" label={copy.label} placeholder={copy.placeholder} register={register} error={errors.note} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={answering}>{copy.cancel}</Button>
            <Button type="submit" size="lg" variant="destructive" loading={answering}>{copy.confirm}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
