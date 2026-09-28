import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckCircle2, CloudUpload, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/tech/SignaturePad';
import { openTasks } from '@/helpers/fieldJob';
import { EMPTY_SIGNATURE, isSignatureLongEnough, signatureToPng } from '@/helpers/signature';
import { formatDateTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';
import { toastError } from '@/redux/slices/uiSlice';

/** 1–5, optional: tap a star to rate, tap it again to take the rating back. */
function RatingStars({ value, onChange, words }) {
  return (
    <div role="group" aria-label={words.rating} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button
          key={n}
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-pressed={value === n}
          aria-label={words.star(n)}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          <Star className={cn('!size-6', n <= value ? 'fill-gold text-gold' : 'text-muted-foreground')} />
        </Button>
      ))}
    </div>
  );
}

/**
 * Finish up: a note, an optional rating, the customer's signature, and "Complete job". The button stays
 * disabled — and says why — while checklist items are open (the API refuses completion then), before the
 * work has started, and until there is a signature (or the technician says the customer is not there).
 *
 * `onComplete({ payload, signature? })` is the page's: with a signature it queues the PNG as a SIGNATURE
 * upload whose `complete` follows it once uploaded (it needs the media id); without one it queues `complete`.
 */
export function FinishSection({ job, copy, onComplete }) {
  const dispatch = useDispatch();
  const words = copy.job.finish;
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [signature, setSignature] = useState(EMPTY_SIGNATURE);
  const [absent, setAbsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = openTasks(job).length;
  const started = job.status === 'IN_PROGRESS';
  const signed = isSignatureLongEnough(signature);
  const blocker = open ? words.openTasks(open) : !started ? words.startFirst : !absent && !signed ? words.signFirst : null;

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(rating ? { customerRating: rating } : {}),
      };
      await onComplete(absent ? { payload } : { payload, signature: await signatureToPng(signature) });
    } catch (err) {
      dispatch(toastError(words.failed, err?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{words.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4 pb-4">
        <div className="space-y-1.5">
          <Label htmlFor="completion-note">{words.note}</Label>
          <Textarea
            id="completion-note"
            value={note}
            maxLength={4000}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={words.notePlaceholder}
            className="text-base"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{words.rating}</p>
          <RatingStars value={rating} onChange={setRating} words={words} />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{words.signature}</p>
          {!absent ? (
            <SignaturePad value={signature} onChange={setSignature} words={copy.signature} />
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1">
            <Checkbox checked={absent} onCheckedChange={(v) => setAbsent(Boolean(v))} className="h-6 w-6 rounded" />
            <span className="text-sm">{words.noSignature}</span>
          </label>
        </div>

        {blocker ? (
          <p id="complete-blocker" className="surface-warning rounded-md border px-3 py-2 text-sm">{blocker}</p>
        ) : null}
        <Button
          size="xl"
          className="w-full"
          disabled={Boolean(blocker)}
          loading={saving}
          aria-describedby={blocker ? 'complete-blocker' : undefined}
          onClick={submit}
        >
          <CheckCircle2 /> {words.complete}
        </Button>
      </CardContent>
    </Card>
  );
}

/** A closed job's ending, read only: when, the note, the rating — or that it is still on its way to the office. */
export function CompletedSummary({ job, copy, signing }) {
  const words = copy.job.finish;
  if (signing) {
    return (
      <p className="surface-warning flex items-center gap-2 rounded-lg border px-3 py-3 text-sm">
        <CloudUpload className="h-4 w-4 shrink-0" aria-hidden /> {words.completing}
      </p>
    );
  }
  if (!['COMPLETED', 'VERIFIED'].includes(job.status)) return null;
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {words.completed}
          {job.actualEnd ? <span className="font-normal text-muted-foreground">· {formatDateTime(job.actualEnd)}</span> : null}
        </p>
        {job.completionNote ? <p className="whitespace-pre-wrap text-muted-foreground">{job.completionNote}</p> : null}
        {job.customerRating ? <p className="text-muted-foreground">{words.rated(job.customerRating)}</p> : null}
        {job.pendingCount ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {copy.job.pending}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
