import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import {
  CheckCircle2, Clock, FileClock, MessageSquareText, Phone, RefreshCw, Wallet, XCircle,
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
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { formatDate, formatDateBs, formatNpr } from '@/helpers/format';

/**
 * A due date as the document states dates: AD, then BS with its era in the page's words — "05 Oct 2026 (2083-06-19
 * B.S.)", "2026 अक्टोबर 05 (2083-06-19 वि.सं.)".
 */
const dueWords = (iso, t) => {
  const ad = formatDate(iso, { locale: t.locale });
  const bs = formatDateBs(iso, { locale: t.locale });
  return bs ? t('document.dates.adBs', { ad, bs }) : ad;
};

/**
 * The words the answer uses that a **variation order** (Phase L7) says its own way: the same page, answered the same
 * way, but a change to job `job` — "Accept this change" / "यो परिवर्तन स्वीकार्नुहोस्", its total repeated in the
 * confirm, and once accepted, that it joined the job (no job number to give, no advance to wait for).
 *
 * @param {ReturnType<typeof import('@/helpers/i18n').createT>} t
 * @param {{ variation: boolean, job: string, total: string }} what
 */
function answerWords(t, { variation, job, total }) {
  if (variation) {
    return {
      promptTitle: t('quotationPage.variation.prompt.title'),
      promptBody: t('quotationPage.variation.prompt.body'),
      accept: t('quotationPage.variation.accept'),
      acceptTitle: t('quotationPage.variation.acceptTitle'),
      acceptBody: t('quotationPage.variation.acceptBody', { job, total }),
      acceptConfirm: t('quotationPage.variation.acceptConfirm'),
      acceptedTitle: t('quotationPage.variation.accepted.title'),
    };
  }
  return {
    promptTitle: t('quotationPage.prompt.title'),
    promptBody: t('quotationPage.prompt.body'),
    accept: t('quotationPage.buttons.accept'),
    acceptTitle: t('quotationPage.accept.title'),
    acceptBody: t('quotationPage.accept.body', { total }),
    acceptConfirm: t('quotationPage.accept.confirm'),
    acceptedTitle: t('quotationPage.outcome.accepted.title'),
  };
}

/**
 * The advance an accepted quotation raised (Phase L6, L-D3): `advance` on the decide answer and on
 * `GET /public/quotations/:token` once converted — `{ number, total, dueDate, status, url }`, `url` the invoice's own
 * public page. "Pay the advance of Rs X by <date>" with a button to that page; "Advance received" once it is PAID;
 * nothing for a void one, or when the quotation asked for no advance (`advance: null`). The amount is the server's.
 *
 * @param {{ advance: { number: string, total: number, dueDate?: string|null, status: string, url?: string|null }|null|undefined }} props
 */
export function AdvanceDue({ advance }) {
  const t = useT(DOCUMENTS);
  if (!advance || advance.status === 'VOID') return null;
  if (advance.status === 'PAID') {
    return (
      <div data-testid="advance-due" data-status="PAID">
        <DocumentNotice tone="success" icon={CheckCircle2} title={t('quotationPage.advance.paid')} animate={false}>
          {t('quotationPage.advance.paidBody', { number: advance.number })}
        </DocumentNotice>
      </div>
    );
  }
  const amount = formatNpr(advance.total, { locale: t.locale });
  return (
    <section data-testid="advance-due" aria-labelledby="q-advance" className="surface-warning space-y-3 rounded-lg border p-4">
      <h2 id="q-advance" className="flex items-start gap-2 text-base font-semibold">
        <Wallet className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <span>
          {advance.dueDate
            ? t('quotationPage.advance.due', { amount, date: dueWords(advance.dueDate, t) })
            : t('quotationPage.advance.dueNoDate', { amount })}
        </span>
      </h2>
      <p className="text-sm opacity-90">{t('quotationPage.advance.body', { number: advance.number })}</p>
      {advance.url ? (
        <Button size="lg" className="h-12 w-full whitespace-normal text-base sm:w-auto" asChild>
          <a href={advance.url}><Wallet aria-hidden /> {t('quotationPage.advance.pay')}</a>
        </Button>
      ) : null}
    </section>
  );
}

/**
 * The customer's answer, and what happens next — in the page's language (`DOCUMENTS.quotationPage`).
 *
 * `state` comes from `quotationPageState`. While the quotation is open, three large
 * buttons — Accept is the primary one, because it is the answer the page exists for —
 * each open one confirm step: Accept repeats the total, Ask for changes takes a message,
 * Decline offers reason chips (Phase L4 — a lost category, sent as `category`) and an
 * optional note. No login, no code, no name. Once accepted, the advance the Accept raised (Phase L6) is shown with
 * its amount, due date and a button to pay it (`AdvanceDue`) — straight after the tap, and on every reload.
 *
 * @param {{ state: { kind: string, actions: string[], replacedToken?: string }, quotation: object,
 *   total: string, phone?: string,
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
  state, quotation, total, phone, onAnswer, answering, error, clearError,
}) {
  const t = useT(DOCUMENTS);
  const [asking, setAsking] = useState(null); // 'approve' | 'request_changes' | 'reject'
  const variation = quotation.kind === 'VARIATION';
  const words = answerWords(t, { variation, job: quotation.job?.number ?? '', total });

  const open = (kind) => { clearError(); setAsking(kind); };
  const close = (isOpen) => { if (!isOpen && !answering) setAsking(null); };
  const answer = async (decision, extra) => {
    const ok = await onAnswer(decision, extra);
    if (ok) setAsking(null);
  };

  switch (state.kind) {
    case 'accepted': {
      const owed = quotation.advance && !['PAID', 'VOID'].includes(quotation.advance.status);
      let body = owed ? t('quotationPage.outcome.accepted.bodyAdvance') : t('quotationPage.outcome.accepted.body');
      if (variation) body = t('quotationPage.variation.accepted.body', { job: quotation.job?.number ?? '' });
      else if (quotation.job?.number) body = `${body} ${t('quotationPage.outcome.accepted.job', { number: quotation.job.number })}`;
      return (
        <div className="space-y-4">
          <DocumentNotice tone="success" icon={CheckCircle2} title={words.acceptedTitle}>{body}</DocumentNotice>
          <AdvanceDue advance={quotation.advance} />
        </div>
      );
    }
    case 'changes':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={MessageSquareText} title={t('quotationPage.outcome.changes.title')}>
            {t('quotationPage.outcome.changes.body')}
          </DocumentNotice>
          {quotation.decisionNote ? (
            <div className="rounded-lg bg-muted/60 p-4 text-sm">
              <p className="font-medium">{t('quotationPage.outcome.changes.yours')}</p>
              <p className="mt-1 whitespace-pre-wrap" lang="ne">{quotation.decisionNote}</p>
            </div>
          ) : null}
        </div>
      );
    case 'declined':
      return (
        <DocumentNotice tone="muted" icon={XCircle} title={t('quotationPage.outcome.declined.title')}>
          {t('quotationPage.outcome.declined.body')}
        </DocumentNotice>
      );
    case 'expired':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="warning" icon={Clock} title={t('quotationPage.outcome.expired.title')} animate={false}>
            {t('quotationPage.outcome.expired.body')}
          </DocumentNotice>
          {phone ? (
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href={`tel:${phone}`}><Phone aria-hidden /> {t('quotationPage.outcome.expired.call', { phone })}</a>
            </Button>
          ) : null}
        </div>
      );
    case 'replaced':
      return (
        <div className="space-y-3">
          <DocumentNotice tone="info" icon={RefreshCw} title={t('quotationPage.outcome.replaced.title')} animate={false}>
            {t('quotationPage.outcome.replaced.body')}
          </DocumentNotice>
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link to={`/quotation/${state.replacedToken}`}>{t('quotationPage.outcome.replaced.open')}</Link>
          </Button>
        </div>
      );
    case 'replacedPending':
      return (
        <DocumentNotice tone="muted" icon={FileClock} title={t('quotationPage.outcome.replacedPending.title')} animate={false}>
          {t('quotationPage.outcome.replacedPending.body')}
        </DocumentNotice>
      );
    case 'open':
      break;
    default:
      return (
        <DocumentNotice tone="muted" title={t('quotationPage.outcome.closed.title')} animate={false}>
          {t('quotationPage.outcome.closed.body')}
        </DocumentNotice>
      );
  }

  const has = (a) => state.actions.includes(a);

  return (
    <section aria-labelledby="q-answer">
      <h2 id="q-answer" className="text-lg font-semibold">{words.promptTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{words.promptBody}</p>

      {error && !asking ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {has('approve') ? (
          <Button size="lg" className="h-14 whitespace-normal text-base" onClick={() => open('approve')}>
            <CheckCircle2 aria-hidden /> {words.accept}
          </Button>
        ) : null}
        {has('request_changes') ? (
          <Button size="lg" variant="outline" className="h-14 whitespace-normal text-base" onClick={() => open('request_changes')}>
            <MessageSquareText aria-hidden /> {t('quotationPage.buttons.changes')}
          </Button>
        ) : null}
        {has('reject') ? (
          <Button size="lg" variant="ghost" className="h-14 whitespace-normal text-base" onClick={() => open('reject')}>
            <XCircle aria-hidden /> {t('quotationPage.buttons.decline')}
          </Button>
        ) : null}
      </div>

      <Dialog open={asking === 'approve'} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{words.acceptTitle}</DialogTitle>
            <DialogDescription>{words.acceptBody}</DialogDescription>
          </DialogHeader>
          <p className="text-center text-3xl font-bold tabular-nums" data-testid="accept-total">{total}</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="lg" onClick={() => close(false)} disabled={answering}>{t('quotationPage.accept.cancel')}</Button>
            <Button size="lg" loading={answering} onClick={() => answer('approve')}>{words.acceptConfirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangesDialog
        open={asking === 'request_changes'}
        onOpenChange={close}
        answering={answering}
        error={error}
        onSubmit={(note) => answer('request_changes', { note })}
      />
      <DeclineDialog
        open={asking === 'reject'}
        onOpenChange={close}
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

function ChangesDialog({ open, onOpenChange, answering, error, onSubmit }) {
  const t = useT(DOCUMENTS);
  const schema = useMemo(
    () => changeRequestSchema({ tooShort: t('quotationPage.changes.tooShort'), tooLong: t('quotationPage.changes.tooLong') }),
    [t],
  );
  const { register, handleSubmit, formState: { errors } } = useZodForm(schema, { defaultValues: { note: '' } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quotationPage.changes.title')}</DialogTitle>
          <DialogDescription>{t('quotationPage.changes.body')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(({ note }) => onSubmit(note))} className="space-y-4">
          <NoteBox
            id="q-changes"
            label={t('quotationPage.changes.label')}
            placeholder={t('quotationPage.changes.placeholder')}
            required
            register={register}
            error={errors.note}
          />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={answering}>{t('quotationPage.changes.cancel')}</Button>
            <Button type="submit" size="lg" loading={answering}>{t('quotationPage.changes.confirm')}</Button>
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
function DeclineDialog({ open, onOpenChange, answering, error, onSubmit }) {
  const t = useT(DOCUMENTS);
  const schema = useMemo(() => declineSchema({ tooLong: t('quotationPage.decline.tooLong') }), [t]);
  const { register, control, handleSubmit, formState: { errors } } = useZodForm(schema, { defaultValues: { note: '', category: null } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quotationPage.decline.title')}</DialogTitle>
          <DialogDescription>{t('quotationPage.decline.body')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <p id="q-decline-reasons" className="text-sm font-medium">{t('quotationPage.decline.reasons')}</p>
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
                      {t(`quotationPage.declineReasons.${c}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </div>
          <NoteBox
            id="q-decline"
            label={t('quotationPage.decline.label')}
            placeholder={t('quotationPage.decline.placeholder')}
            register={register}
            error={errors.note}
          />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={answering}>{t('quotationPage.decline.cancel')}</Button>
            <Button type="submit" size="lg" variant="destructive" loading={answering}>{t('quotationPage.decline.confirm')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
