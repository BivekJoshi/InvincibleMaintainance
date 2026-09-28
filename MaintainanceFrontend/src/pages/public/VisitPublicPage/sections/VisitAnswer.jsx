import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  CalendarCheck2, CalendarX2, CheckCircle2, Lock, Navigation, Phone, PhoneCall, XCircle,
} from 'lucide-react';
import { DocumentNotice } from '@/components/documents/DocumentNotice';
import { Button } from '@/components/ui/button';
import { telHref } from '../visitPageState';
import { RescheduleForm } from './RescheduleForm';

/** How each state that takes no answer looks. */
const CLOSED_LOOK = {
  cancelled: { tone: 'muted', icon: XCircle },
  underway: { tone: 'info', icon: Navigation },
  done: { tone: 'success', icon: CheckCircle2 },
  closed: { tone: 'muted', icon: Lock },
};

/** Big, full width on a phone, allowed to wrap. */
const BIG = 'h-auto min-h-14 w-full whitespace-normal py-2 text-base';

function CallOffice({ phone, copy }) {
  if (!phone) return null;
  return (
    <Button asChild size="xl" className="h-auto min-h-12 w-full whitespace-normal py-2 sm:w-auto">
      <a href={telHref(phone)}><Phone aria-hidden /> {copy.call(phone)}</a>
    </Button>
  );
}

/**
 * The customer's answer, and what happens next — in the page's language (`copy`, from `visitPageCopy.js`).
 *
 * `state` comes from `visitPageState`. With no answer yet: two big buttons, **Confirm** (one tap — the answer can
 * be changed, so no confirm step) and **Need another time** (an inline form with an optional note). Once
 * answered, what was recorded — "we will see you …", or "we will call you" with their note — and **Change my
 * answer** while the API still takes one (the latest answer wins). When it no longer does (past, under way, done,
 * cancelled): no buttons, a line to call the office.
 *
 * @param {{ state: { kind: string, canAnswer: boolean }, when: { day: string, time: string }|null,
 *   note?: string|null, officePhone?: string, copy: object,
 *   onAnswer: (answer: 'confirm'|'reschedule', note?: string) => Promise<boolean>,
 *   answering: boolean, error?: string|null, clearError: () => void }} props
 */
export function VisitAnswer({ state, when, note, officePhone, copy, onAnswer, answering, error, clearError }) {
  const animate = !useReducedMotion();
  const [changing, setChanging] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(null); // which button is waiting on the API

  const answer = async (kind, text) => {
    setPending(kind);
    const ok = await onAnswer(kind, text);
    setPending(null);
    if (ok) { setAsking(false); setChanging(false); }
  };
  const ask = () => { clearError(); setAsking(true); };

  if (!state.canAnswer) {
    const look = CLOSED_LOOK[state.kind] ?? CLOSED_LOOK.closed;
    const words = copy.outcome[state.kind] ?? copy.outcome.closed;
    return (
      <div className="space-y-3">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DocumentNotice tone={look.tone} icon={look.icon} title={words.title} animate={false}>{words.body}</DocumentNotice>
        <CallOffice phone={officePhone} copy={copy} />
      </div>
    );
  }

  if ((state.kind === 'confirmed' || state.kind === 'reschedule') && !changing) {
    const change = (
      <Button type="button" size="xl" variant="outline" className="h-auto min-h-12 w-full whitespace-normal py-2 sm:w-auto" onClick={() => { clearError(); setChanging(true); }}>
        {copy.outcome.change}
      </Button>
    );
    if (state.kind === 'confirmed') {
      return (
        <div className="space-y-3">
          <DocumentNotice tone="success" icon={CalendarCheck2} title={copy.outcome.confirmed.title} animate={animate}>
            {when ? copy.outcome.confirmed.body(when.day, when.time) : null}
          </DocumentNotice>
          {change}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <DocumentNotice tone="info" icon={PhoneCall} title={copy.outcome.reschedule.title} animate={animate}>
          {copy.outcome.reschedule.body}
        </DocumentNotice>
        {note ? (
          <div className="rounded-lg bg-muted/60 p-4 text-sm" data-testid="visit-note-echo">
            <p className="font-medium">{copy.outcome.reschedule.yours}</p>
            <p className="mt-1 whitespace-pre-wrap break-words" lang="ne">{note}</p>
          </div>
        ) : null}
        {change}
      </div>
    );
  }

  return (
    <section aria-labelledby="visit-answer-title">
      <h2 id="visit-answer-title" className="text-lg font-semibold">{copy.prompt.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.prompt.body}</p>

      {asking ? (
        <div className="mt-4">
          <RescheduleForm
            copy={copy.reschedule}
            initialNote={state.kind === 'reschedule' ? note : ''}
            answering={answering}
            error={error}
            onSubmit={(text) => answer('reschedule', text)}
            onCancel={() => { clearError(); setAsking(false); }}
          />
        </div>
      ) : (
        <>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button type="button" size="xl" className={BIG} loading={pending === 'confirm'} disabled={answering} onClick={() => answer('confirm')}>
              <CheckCircle2 aria-hidden /> {copy.buttons.confirm}
            </Button>
            <Button type="button" size="xl" variant="outline" className={BIG} disabled={answering} onClick={ask}>
              <CalendarX2 aria-hidden /> {copy.buttons.reschedule}
            </Button>
          </div>
          {changing ? (
            <Button type="button" variant="ghost" className="mt-2 h-12 w-full" onClick={() => { clearError(); setChanging(false); }}>
              {copy.buttons.keep}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
