import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, CloudUpload, Flag, ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { usePendingPicture } from '@/hooks/usePendingPicture';
import { compressImage } from '@/helpers/compressImage';
import { answerNumber, flagRule, predictFlag, questionLabel } from '@/helpers/inspection';
import { mediaIdForUpload, thumbFor } from '@/helpers/sentPhotos';
import { imageUrl, titleCase } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { SURVEY_METRICS } from '@/config/constants';
import { selectFieldUploads } from '@/redux/slices/fieldSyncSlice';
import { toastError } from '@/redux/slices/uiSlice';
import { blankReading, questionDomId, serverFlagFor } from '@/pages/tech/SurveyFormPage/surveyForm';

const CHIP = 'h-12 min-w-16 border px-4 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

/** The flag's rule in words, under the question: "flagged above 20 %". */
function ruleText(question, t) {
  const rule = flagRule(question);
  if (!rule) return null;
  if (rule.type === 'range') return rule.parts.map((p) => t.rule[p.op](p.value)).join(' · ');
  if (rule.type === 'equals') return t.rule.equals(rule.value === 'yes' ? t.yes : t.no);
  return t.rule.values(rule.values.join(', '));
}

/**
 * A photo-required question's picture: taken with the rear camera, compressed and put in the upload queue
 * (`useFieldQueue#queueUpload`, ISSUE, captioned with the question). The answer keeps the queue entry's id
 * (`photoUploadId`) until the picture is on the server; the sync engine sends the reading with its `mediaId`.
 */
function QuestionPhoto({ question, answer, surveyId, media, onPhoto, readOnly, words }) {
  const t = words.checklist;
  const dispatch = useDispatch();
  const { queueUpload } = useFieldQueue();
  const uploads = useSelector(selectFieldUploads);
  const [preparing, setPreparing] = useState(false);

  const uploadId = answer?.photoUploadId ?? null;
  const waiting = Boolean(uploadId && uploads.some((u) => u.id === uploadId));
  const mediaId = answer?.mediaId ?? (uploadId && !waiting ? mediaIdForUpload(uploadId) : null);
  const pendingSrc = usePendingPicture(waiting ? uploadId : null);
  const src = pendingSrc ?? (mediaId ? imageUrl(media?.[mediaId], 400) ?? thumbFor(mediaId) : null);
  const taken = Boolean(uploadId || mediaId);
  const inputId = `${questionDomId(question.key)}-photo`;

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPreparing(true);
    try {
      const small = await compressImage(file);
      const entry = await queueUpload({
        target: 'survey', targetId: surveyId, kind: 'ISSUE', caption: question.label, file: small, name: small.name ?? file.name,
      });
      onPhoto({ photoUploadId: entry.id, mediaId: undefined });
    } catch (err) {
      dispatch(toastError(t.photoFailed, err?.message));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
        {src ? <img src={src} alt={question.label} className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" aria-hidden /></div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {taken ? (
          <p className={cn('flex items-center gap-1 text-xs font-medium', waiting ? 'text-warning' : 'text-success')}>
            {waiting ? <CloudUpload className="h-3.5 w-3.5" aria-hidden /> : null}
            {waiting ? t.photoWaiting : t.photoSent}
          </p>
        ) : null}
        {!readOnly ? (
          <label
            className={cn(
              buttonVariants({ variant: taken ? 'outline' : 'default', size: 'lg' }),
              'relative h-12 w-full cursor-pointer gap-2 px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              preparing ? 'pointer-events-none opacity-70' : '',
            )}
          >
            {preparing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {taken ? t.retake : t.takePhoto}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onFile}
              aria-label={`${taken ? t.retake : t.takePhoto}: ${question.label}`}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

/** The control for one question's answer, by its type. */
function AnswerInput({ question, answer, onAnswer, readOnly, label, words }) {
  const t = words.checklist;
  const id = `${questionDomId(question.key)}-input`;
  switch (question.type) {
    case 'YES_NO':
      return (
        <ToggleGroup
          type="single"
          value={answer?.textValue ?? ''}
          onValueChange={(v) => onAnswer({ textValue: v || '' })}
          disabled={readOnly}
          aria-label={label}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem value="yes" variant="outline" className={cn(CHIP, 'h-14')}>{t.yes}</ToggleGroupItem>
          <ToggleGroupItem value="no" variant="outline" className={cn(CHIP, 'h-14')}>{t.no}</ToggleGroupItem>
        </ToggleGroup>
      );
    case 'NUMBER': {
      const n = answerNumber(answer?.value);
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={answer?.value ?? ''}
              onChange={(e) => onAnswer({ value: e.target.value })}
              placeholder={t.numberPlaceholder}
              disabled={readOnly}
              aria-label={label}
              aria-invalid={Number.isNaN(n) || undefined}
              className="h-12 text-lg tabular-nums"
            />
            {question.unit ? <span className="shrink-0 text-base font-medium text-muted-foreground">{question.unit}</span> : null}
          </div>
          {Number.isNaN(n) ? <p className="text-xs text-destructive">{t.notANumber}</p> : null}
        </div>
      );
    }
    case 'CHOICE':
      return (
        <ToggleGroup
          type="single"
          value={answer?.textValue ?? ''}
          onValueChange={(v) => onAnswer({ textValue: v || '' })}
          disabled={readOnly}
          aria-label={label}
          className="flex flex-wrap justify-start gap-2"
        >
          {(question.options ?? []).map((option) => (
            <ToggleGroupItem key={option} value={option} variant="outline" className={CHIP}>{option}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    default:
      return (
        <Textarea
          id={id}
          rows={2}
          value={answer?.textValue ?? ''}
          onChange={(e) => onAnswer({ textValue: e.target.value })}
          placeholder={t.textPlaceholder}
          disabled={readOnly}
          aria-label={label}
          className="text-base"
        />
      );
  }
}

/** One question as a card: its words, the answer control, the live flag, the photo, and what is missing. */
function QuestionCard({ question, answer, onAnswer, missing, flagged, surveyId, media, readOnly, locale, words }) {
  const t = words.checklist;
  const label = questionLabel(question, locale);
  const rule = ruleText(question, t);
  const headingId = `${questionDomId(question.key)}-label`;

  return (
    <li
      id={questionDomId(question.key)}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      aria-invalid={missing ? true : undefined}
      className={cn(
        'space-y-3 rounded-lg border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        flagged ? 'surface-warning' : '',
        missing ? 'border-destructive ring-1 ring-destructive' : '',
      )}
      data-flagged={flagged || undefined}
    >
      <div className="space-y-1">
        <p id={headingId} className="text-base font-medium leading-snug">{label}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {question.required ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{t.required}</span> : null}
          {question.photoRequired ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{t.photoRequired}</span> : null}
          {rule ? <span className="text-muted-foreground">{rule}</span> : null}
        </div>
      </div>

      <AnswerInput question={question} answer={answer} onAnswer={onAnswer} readOnly={readOnly} label={label} words={words} />

      {flagged ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning" data-testid={`flag-${question.key}`}>
          <Flag className="h-4 w-4" aria-hidden /> {t.flagged} — <span className="font-normal">{t.flaggedBody}</span>
        </p>
      ) : null}

      {question.photoRequired ? (
        <QuestionPhoto
          question={question}
          answer={answer}
          surveyId={surveyId}
          media={media}
          onPhoto={onAnswer}
          readOnly={readOnly}
          words={words}
        />
      ) : null}

      {missing ? (
        <p className="text-sm font-medium text-destructive">{missing === 'photo' ? t.missingPhoto : t.missingAnswer}</p>
      ) : null}
    </li>
  );
}

/** Readings that answer no question: where, what, a value with its unit, or an observation. */
function OtherReadings({ readings, onChange, readOnly, words }) {
  const t = words.checklist;
  const set = (i, patch) => onChange(readings.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.other}</CardTitle>
        <p className="text-xs text-muted-foreground">{t.otherBody}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {readings.map((r, i) => (
          <div key={r._key ?? i} role="group" aria-label={t.readingLabel(i + 1)} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2">
              <Input
                value={r.label} onChange={(e) => set(i, { label: e.target.value })}
                placeholder={t.where} disabled={readOnly} aria-label={`${t.readingLabel(i + 1)}: ${t.where}`} className="h-11"
              />
              <Button
                type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0"
                onClick={() => onChange(readings.filter((_, idx) => idx !== i))}
                disabled={readOnly} aria-label={t.removeReading(i + 1)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={r.metric} onValueChange={(v) => set(i, { metric: v })} disabled={readOnly}>
                <SelectTrigger className="h-11" aria-label={`${t.readingLabel(i + 1)}: ${t.metric}`}><SelectValue /></SelectTrigger>
                <SelectContent>{SURVEY_METRICS.map((m) => <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>)}</SelectContent>
              </Select>
              <Input
                inputMode="decimal" value={r.value} onChange={(e) => set(i, { value: e.target.value })}
                placeholder={t.value} disabled={readOnly} aria-label={`${t.readingLabel(i + 1)}: ${t.value}`} className="h-11"
              />
              <Input
                value={r.unit} onChange={(e) => set(i, { unit: e.target.value })}
                placeholder={t.unit} disabled={readOnly} aria-label={`${t.readingLabel(i + 1)}: ${t.unit}`} className="h-11"
              />
            </div>
            <Input
              value={r.textValue} onChange={(e) => set(i, { textValue: e.target.value })}
              placeholder={t.observation} disabled={readOnly} aria-label={`${t.readingLabel(i + 1)}: ${t.observation}`} className="h-11"
            />
          </div>
        ))}
        {!readOnly ? (
          <Button type="button" variant="outline" className="h-12 w-full" onClick={() => onChange([...readings, blankReading()])}>
            <Plus className="h-4 w-4" /> {t.addReading}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Step 3 — the service's checklist, from its inspection template: yes/no as two big toggles, a number with
 * its unit, a choice as chips, words; each answer that crosses the question's flag is highlighted at once
 * (`helpers/inspection#predictFlag`), and once the server holds the same answer its own `flagged` decides.
 * Photo-required questions take their photo here. When a submit was stopped, the missing answers and photos
 * are marked on their cards. Other readings follow.
 *
 * @param {{ survey: object, form: object, onAnswer: (key: string, patch: object) => void,
 *   onReadings: (readings: object[]) => void, missing: Map<string, 'answer'|'photo'>|null, readOnly: boolean,
 *   locale: string, words: object }} props
 */
export function ChecklistStep({ survey, form, onAnswer, onReadings, missing, readOnly, locale, words }) {
  const t = words.checklist;
  const template = survey.template;
  const questions = template?.questions ?? [];

  return (
    <div className="space-y-4">
      {template ? (
        <p className="text-sm text-muted-foreground">{t.from(template.name)}</p>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.none}</p>
      )}

      {questions.length ? (
        <ol className="space-y-3" aria-label={t.title}>
          {questions.map((question) => {
            const answer = form.answers?.[question.key];
            const server = serverFlagFor(question, answer, survey);
            return (
              <QuestionCard
                key={question.key}
                question={question}
                answer={answer}
                onAnswer={(patch) => onAnswer(question.key, patch)}
                missing={missing?.get(question.key) ?? null}
                flagged={server ?? predictFlag(question, answer)}
                surveyId={survey.id}
                media={survey.media}
                readOnly={readOnly}
                locale={locale}
                words={words}
              />
            );
          })}
        </ol>
      ) : null}

      <OtherReadings readings={form.readings ?? []} onChange={onReadings} readOnly={readOnly} words={words} />
    </div>
  );
}
