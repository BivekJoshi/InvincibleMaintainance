import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DOCUMENTS } from '@/config/i18n/documents';
import { useT } from '@/hooks/useT';
import { cn } from '@/helpers/utils';
import { VISIT_NOTE_MAX } from '../visitPageState';

/**
 * "Need another time": an inline form (no dialog to lose on a phone) with an optional note — when would suit
 * them — counted against the API's limit, and a send button. It opens with the cursor in the note.
 *
 * @param {{ initialNote?: string|null, answering: boolean, error?: string|null,
 *   onSubmit: (note: string) => void, onCancel: () => void }} props `initialNote` — their earlier note, when they
 *   are changing an earlier "Need another time"
 */
export function RescheduleForm({ initialNote, answering, error, onSubmit, onCancel }) {
  const t = useT(DOCUMENTS);
  const [note, setNote] = useState(initialNote ?? '');
  const box = useRef(null);
  useEffect(() => { box.current?.focus(); }, []);

  const tooLong = note.length > VISIT_NOTE_MAX;
  const submit = (event) => {
    event.preventDefault();
    if (!tooLong) onSubmit(note);
  };

  return (
    <form noValidate onSubmit={submit} aria-labelledby="visit-reschedule-title" className="space-y-3 rounded-lg border p-4">
      <h3 id="visit-reschedule-title" className="text-base font-semibold">{t('visit.reschedule.title')}</h3>
      <p className="text-sm text-muted-foreground">{t('visit.reschedule.body')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="visit-note">{t('visit.reschedule.label')}</Label>
        <Textarea
          id="visit-note"
          ref={box}
          rows={3}
          lang="ne"
          maxLength={VISIT_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('visit.reschedule.placeholder')}
          aria-invalid={tooLong || undefined}
          aria-describedby="visit-note-count"
          // 16 px, so a phone does not zoom in on focus.
          className="text-base"
        />
        <p
          id="visit-note-count"
          className={cn('text-right text-xs tabular-nums', tooLong ? 'font-medium text-destructive' : 'text-muted-foreground')}
        >
          {tooLong
            ? t('visit.reschedule.tooLong', { max: VISIT_NOTE_MAX })
            : t('visit.reschedule.count', { count: note.length, max: VISIT_NOTE_MAX })}
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" size="xl" className="h-auto min-h-14 whitespace-normal py-2 text-base" loading={answering} disabled={tooLong}>
          {t('visit.reschedule.send')}
        </Button>
        <Button type="button" size="xl" variant="outline" className="h-auto min-h-12 whitespace-normal py-2" onClick={onCancel} disabled={answering}>
          {t('visit.reschedule.cancel')}
        </Button>
      </div>
    </form>
  );
}
