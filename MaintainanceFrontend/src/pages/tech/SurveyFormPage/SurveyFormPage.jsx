import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { ArrowLeft, ArrowRight, CloudUpload, Loader2, Send } from 'lucide-react';
import { useGetMySurveyQuery, useGetTechMaterialsQuery, useGetTechRateCardQuery } from '@/api/techApi';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { missingAnswers, questionLabel } from '@/helpers/inspection';
import { mediaIdForUpload } from '@/helpers/sentPhotos';
import { pending } from '@/helpers/offlineQueue';
import { fieldNoteDismissed, selectFieldSync } from '@/redux/slices/fieldSyncSlice';
import { selectLocale, toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { StepBar } from './sections/StepBar';
import { IncompletePanel } from './sections/IncompletePanel';
import { BeforeYouGoStep } from './steps/BeforeYouGoStep';
import { ArrivedStep } from './steps/ArrivedStep';
import { ChecklistStep } from './steps/ChecklistStep';
import { MeasurementsStep } from './steps/MeasurementsStep';
import { PhotosStep } from './steps/PhotosStep';
import { FindingsStep } from './steps/FindingsStep';
import { LinesStep } from './steps/LinesStep';
import {
  AUTOSAVE_MS, EDITABLE_STATUSES, SURVEY_STEPS, areasOf, questionDomId, serverQtyFor, stepProgress, surveyPayload,
  surveyToForm,
} from './surveyForm';

const isDraftOf = (id) => (entry) => entry.kind === 'survey_draft' && entry.surveyId === id;

/**
 * The surveyor's guided, offline stepper (Phase L5) — seven steps, one file each under `steps/`:
 * Before you go · Arrived · Checklist · Measure · Photos · Findings · Lines. The step is in the URL (`?step=`,
 * and `&line=` for the line being measured), so Back and a reload land where the surveyor was.
 *
 * **Every write is a `survey_draft`** through the field app's queue (`useFieldQueue`), online or not: a change
 * is saved on the phone a moment after the last tap (`AUTOSAVE_MS`), on every step change and when the screen
 * goes, as the whole survey (`surveyForm.js#surveyPayload` — fields, readings, lines with their measurement
 * rows, the site pin); a newer draft replaces an older one still waiting. The form as typed rides along in
 * the entry's `meta` (never sent), so coming back before it is sent shows what was typed. Photos go through
 * the upload queue; a checklist photo is linked to its reading by the sync engine once uploaded.
 *
 * **Submit** checks the template first (`helpers/inspection#missingAnswers`, the server's rule) and, if an
 * answer or a photo is missing, opens the checklist with each one marked; otherwise it queues the last draft
 * and `survey_submit`. The office's own 422 `SURVEY_INCOMPLETE` (a refused `survey_submit`) comes back as a
 * note, and is shown the same way. No price, rate or cost anywhere (D1).
 */
export default function SurveyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const store = useStore();
  const copy = useFieldCopy();
  const words = copy.survey;
  const locale = useSelector(selectLocale);
  const [params, setParams] = useSearchParams();
  const step = SURVEY_STEPS.includes(params.get('step')) ? params.get('step') : SURVEY_STEPS[0];
  const lineKey = params.get('line');

  const { data: survey, isLoading, error, refetch } = useGetMySurveyQuery(id);
  const { data: rateCard } = useGetTechRateCardQuery();
  const { data: materials } = useGetTechMaterialsQuery();
  const { queueMutation, syncNow } = useFieldQueue();
  const { mutations, uploads, notes } = useSelector(selectFieldSync);

  const [form, setForm] = useState(null);
  const [visited, setVisited] = useState(() => new Set([step]));
  const [incomplete, setIncomplete] = useState(null); // { office: boolean, items: [] }
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const formRef = useRef(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const templateRef = useRef(null);
  templateRef.current = survey?.template ?? null;

  // The form starts from the newest save still waiting on this phone, else from the server.
  useEffect(() => {
    if (!survey || form) return undefined;
    let alive = true;
    const start = (next) => {
      if (!alive) return;
      formRef.current = next;
      setForm(next);
    };
    pending()
      .then((queue) => {
        const waiting = [...queue].reverse().find((e) => isDraftOf(id)(e) && e.meta?.form);
        start(waiting ? { ...surveyToForm(survey), ...waiting.meta.form } : surveyToForm(survey));
      })
      .catch(() => start(surveyToForm(survey)));
    return () => { alive = false; };
  }, [survey, form, id]);

  /** Queues the survey as it stands now, replacing a draft still waiting. */
  const saveNow = useCallback(async () => {
    clearTimeout(timerRef.current);
    const current = formRef.current;
    if (!dirtyRef.current || !current) return;
    dirtyRef.current = false;
    await queueMutation(
      { kind: 'survey_draft', surveyId: id, payload: surveyPayload(current, templateRef.current), meta: { form: current } },
      { supersede: isDraftOf(id) },
    );
  }, [id, queueMutation]);

  const change = useCallback((updater) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      formRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveNow(); }, AUTOSAVE_MS);
  }, [saveNow]);

  // Leaving the screen, or the phone locking, saves what is not saved yet.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      saveNow();
    };
  }, [saveNow]);

  // A checklist photo that has reached the server: keep its media id on the answer (no new save needed —
  // the sync engine already sends it resolved).
  useEffect(() => {
    const current = formRef.current;
    if (!current) return;
    let swapped = null;
    for (const [key, answer] of Object.entries(current.answers ?? {})) {
      if (!answer?.photoUploadId || uploads.some((u) => u.id === answer.photoUploadId)) continue;
      const mediaId = mediaIdForUpload(answer.photoUploadId);
      if (!mediaId) continue;
      swapped ??= { ...current.answers };
      const { photoUploadId: _sent, ...rest } = answer;
      swapped[key] = { ...rest, mediaId };
    }
    if (swapped) {
      const next = { ...current, answers: swapped };
      formRef.current = next;
      setForm(next);
    }
  }, [uploads]);

  useEffect(() => {
    setVisited((v) => (v.has(step) ? v : new Set(v).add(step)));
  }, [step]);

  // The office refused a submit for a missing answer while the survey was closed: show it here.
  const officeNote = notes.find((n) => n.surveyId === id && n.code === 'SURVEY_INCOMPLETE');
  useEffect(() => {
    if (!officeNote || !form || submittingRef.current) return;
    setIncomplete({ office: true, items: officeNote.details?.length ? officeNote.details : missingAnswers(survey?.template, form.answers) });
    dispatch(fieldNoteDismissed(officeNote.id));
  }, [officeNote, form, survey, dispatch]);

  const goTo = useCallback((next, extra = {}) => {
    saveNow();
    setParams({ step: next, ...extra }, { replace: true });
    document.getElementById('survey-top')?.scrollIntoView?.({ block: 'start' });
  }, [saveNow, setParams]);

  // After a stopped submit, the first missing question takes the focus.
  useEffect(() => {
    if (!incomplete?.items?.length || step !== 'checklist') return;
    const first = document.getElementById(questionDomId(incomplete.items[0].questionKey));
    first?.scrollIntoView?.({ block: 'center' });
    first?.focus?.();
  }, [incomplete, step]);

  const template = survey?.template ?? null;
  const surveyPhotos = (survey?.job?.photos?.length ?? 0) + uploads.filter((u) => u.target === 'survey' && u.targetId === id).length;
  const progress = useMemo(
    () => (form && survey ? stepProgress(form, survey, { visited, photos: surveyPhotos }) : {}),
    [form, survey, visited, surveyPhotos],
  );

  if (error) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;
  if (isLoading || !form) return <PageTransition><CardSkeleton /></PageTransition>;

  const submitWaiting = mutations.some((m) => m.kind === 'survey_submit' && m.surveyId === id);
  const draftWaiting = mutations.some(isDraftOf(id));
  const editable = EDITABLE_STATUSES.includes(survey.status) && !submitWaiting;
  const readOnly = !editable;

  // What is still missing, live — the panel empties as the surveyor fills it in. What the office named stays
  // until that question is touched (the office may know better than the phone: a photo it never received).
  const missingNow = incomplete ? missingAnswers(template, form.answers) : [];
  const panelItems = [];
  if (incomplete) {
    const seen = new Set();
    const officeItems = incomplete.office ? incomplete.items.filter((it) => !incomplete.touched?.has(it.questionKey)) : [];
    for (const item of [...officeItems, ...missingNow]) {
      if (seen.has(item.questionKey)) continue;
      seen.add(item.questionKey);
      panelItems.push(item);
    }
  }
  const missingMap = incomplete ? new Map(panelItems.map((m) => [m.questionKey, m.missing])) : null;
  const steps = progress.checklist ? { ...progress, checklist: { ...progress.checklist, alert: panelItems.length > 0 } } : progress;
  const labelOf = (key, fallback) => {
    const q = template?.questions?.find((x) => x.key === key);
    return q ? questionLabel(q, locale) : fallback;
  };

  const serverQty = (item) => serverQtyFor(item, form, survey);
  const index = SURVEY_STEPS.indexOf(step);
  const last = index === SURVEY_STEPS.length - 1;

  const onSubmit = async () => {
    const missing = missingAnswers(template, form.answers);
    if (missing.length) {
      setIncomplete({ office: false, items: missing });
      goTo('checklist');
      return;
    }
    setSubmitting(true);
    submittingRef.current = true;
    try {
      dirtyRef.current = true;
      await saveNow();
      const key = await queueMutation({ kind: 'survey_submit', surveyId: id, payload: {} });
      if (!navigator.onLine) {
        dispatch(toastSuccess(words.queued, words.queuedBody));
        navigate('/tech/surveys');
        return;
      }
      await syncNow();
      const state = store.getState().fieldSync;
      const refused = state.notes.find((n) => n.surveyId === id && n.kind === 'survey_submit');
      if (refused) {
        dispatch(fieldNoteDismissed(refused.id));
        if (refused.code === 'SURVEY_INCOMPLETE') {
          setIncomplete({ office: true, items: refused.details?.length ? refused.details : missing });
          goTo('checklist');
        } else {
          dispatch(toastError(refused.message ?? copy.sync.refusedTitle));
        }
        return;
      }
      if (state.mutations.some((m) => m.idempotencyKey === key)) {
        dispatch(toastSuccess(words.queued, words.queuedBody));
      } else {
        dispatch(toastSuccess(words.submitted, words.submittedBody));
      }
      navigate('/tech/surveys');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onAnswer = (key, patch) => {
    if (incomplete?.office && !incomplete.touched?.has(key)) {
      setIncomplete((prev) => (prev ? { ...prev, touched: new Set(prev.touched ?? []).add(key) } : prev));
    }
    change((f) => ({ ...f, answers: { ...f.answers, [key]: { ...f.answers?.[key], ...patch } } }));
  };

  return (
    <PageTransition>
      <div id="survey-top" className="mb-3 flex scroll-mt-20 items-start gap-3">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => { saveNow(); navigate('/tech/surveys'); }} aria-label={words.back}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{survey.number}</span>
            <StatusBadge status={survey.status} />
            {draftWaiting ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {words.saved}
              </span>
            ) : null}
          </div>
          <p className="truncate font-semibold">{survey.customer?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{survey.service?.name ?? words.list.general}</p>
        </div>
      </div>

      {survey.returnedReason && editable ? (
        <p className="mb-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {words.returned(survey.returnedReason)}
        </p>
      ) : null}
      {submitWaiting ? (
        <p className="surface-warning mb-3 rounded-md border px-3 py-2 text-sm">{words.submitWaiting}</p>
      ) : !EDITABLE_STATUSES.includes(survey.status) ? (
        <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{words.locked}</p>
      ) : null}

      <StepBar steps={SURVEY_STEPS} current={step} progress={steps} onPick={(s) => goTo(s)} words={words} />

      <p className="text-xs text-muted-foreground">{words.stepOf(index + 1, SURVEY_STEPS.length)}</p>
      <h1 className="mb-3 text-lg font-semibold">{words.steps[step]}</h1>

      {step === 'checklist' ? (
        <IncompletePanel items={panelItems} office={Boolean(incomplete?.office)} labelOf={labelOf} words={words} />
      ) : null}

      {step === 'before' ? <BeforeYouGoStep survey={survey} words={words} /> : null}
      {step === 'arrived' ? (
        <ArrivedStep site={survey.site} pin={form.sitePin} onPin={(pin) => change({ sitePin: pin })} readOnly={readOnly} words={words} />
      ) : null}
      {step === 'checklist' ? (
        <ChecklistStep
          survey={survey}
          form={form}
          onAnswer={onAnswer}
          onReadings={(readings) => change({ readings })}
          missing={missingMap}
          readOnly={readOnly}
          locale={locale}
          words={words}
        />
      ) : null}
      {step === 'measure' ? (
        <MeasurementsStep
          items={form.items}
          lineKey={lineKey}
          onPickLine={(key) => goTo('measure', { line: key })}
          onItems={(items) => change({ items })}
          serverQty={serverQty}
          readOnly={readOnly}
          words={words}
        />
      ) : null}
      {step === 'photos' ? <PhotosStep survey={survey} areas={areasOf(form)} readOnly={readOnly} copy={copy} /> : null}
      {step === 'findings' ? <FindingsStep form={form} onChange={change} readOnly={readOnly} words={words} /> : null}
      {step === 'lines' ? (
        <LinesStep
          items={form.items}
          onItems={(items) => change({ items })}
          onMeasure={(key) => goTo('measure', { line: key })}
          serverQty={serverQty}
          materials={materials ?? []}
          rateCard={rateCard ?? []}
          readOnly={readOnly}
          words={words}
        />
      ) : null}

      <div
        className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          type="button" variant="outline" className="h-12 flex-1"
          onClick={() => goTo(SURVEY_STEPS[index - 1])} disabled={index === 0}
        >
          <ArrowLeft className="h-4 w-4" /> {words.previous}
        </Button>
        {last ? (
          editable ? (
            <Button type="button" className="h-12 flex-1" onClick={onSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {words.submit}
            </Button>
          ) : null
        ) : (
          <Button type="button" className="h-12 flex-1" onClick={() => goTo(SURVEY_STEPS[index + 1])}>
            {words.next} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </PageTransition>
  );
}
