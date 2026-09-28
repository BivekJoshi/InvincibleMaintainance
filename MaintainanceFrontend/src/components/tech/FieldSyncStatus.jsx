import { Link } from 'react-router-dom';
import { CheckCircle2, CloudOff, Loader2, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/utils';

/**
 * What the field app's header says about the phone's queue (`hooks/useOfflineQueue#useOfflineQueue`):
 * offline, syncing, how many changes and photos wait — the button sends them now — or all sent.
 *
 * @param {{ sync: ReturnType<typeof import('@/hooks/useOfflineQueue').useOfflineQueue>, copy: object }} props
 */
export function SyncButton({ sync, copy }) {
  const { count, online, syncing, syncNow } = sync;
  const words = copy.sync;

  let icon = <CheckCircle2 aria-hidden />;
  let label = words.allSent;
  if (!online) {
    icon = <CloudOff aria-hidden />;
    label = words.offline;
  } else if (syncing && count) {
    icon = <Loader2 className="animate-spin" aria-hidden />;
    label = words.syncing;
  } else if (count) {
    icon = <RefreshCw aria-hidden />;
    label = words.syncNow;
  }

  return (
    <Button
      type="button"
      variant={count && online ? 'outline' : 'ghost'}
      size="lg"
      className={cn('h-11 shrink-0 gap-1.5 px-3', !online ? 'text-warning' : '', !count && online ? 'text-muted-foreground' : '')}
      onClick={() => syncNow()}
      disabled={!online || syncing}
      aria-label={count ? `${label} — ${words.waiting(count)}` : label}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {count ? (
        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-hidden>
          {count}
        </span>
      ) : null}
    </Button>
  );
}

/** A refused change in words: "Status “On the way” — This job cannot move from Completed…". */
function noteText(note, copy) {
  const kinds = copy.sync.kinds;
  if (note.source === 'upload') return note.completes ? kinds.signature : kinds.photo;
  if (note.kind === 'status') return kinds.status(copy.status[note.status] ?? note.status);
  return kinds[note.kind] ?? note.kind;
}

/**
 * The strip under the header: no signal (and what is kept on the phone), and each change the office
 * refused for good — dropped from the queue, so it is said once here until dismissed.
 */
export function SyncBanner({ sync, copy }) {
  const { online, changes, photos, notes, dismissNote } = sync;
  const words = copy.sync;
  const what = words.what(changes, photos);

  return (
    <div aria-live="polite">
      {!online ? (
        <p className="surface-warning flex items-center gap-2 border-b px-4 py-2 text-xs font-medium">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          {words.offlineBanner(what)}
        </p>
      ) : null}
      {notes.map((note) => (
        <div key={note.id} role="alert" className="flex items-start gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{words.refusedTitle}</p>
            <p>
              {noteText(note, copy)}
              {note.message ? ` — ${note.message}` : ''}
            </p>
            {note.jobId ? (
              <Link to={`/tech/jobs/${note.jobId}`} className="mt-0.5 inline-block font-medium underline underline-offset-2">
                {copy.today.open}
              </Link>
            ) : note.surveyId ? (
              <Link
                to={`/tech/surveys/${note.surveyId}${note.code === 'SURVEY_INCOMPLETE' ? '?step=checklist' : ''}`}
                className="mt-0.5 inline-block font-medium underline underline-offset-2"
              >
                {copy.sync.openSurvey}
              </Link>
            ) : null}
          </div>
          <Button
            type="button" variant="ghost" size="icon" className="-mr-2 -mt-1 h-10 w-10 shrink-0 text-destructive"
            onClick={() => dismissNote(note.id)} aria-label={words.dismiss}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
