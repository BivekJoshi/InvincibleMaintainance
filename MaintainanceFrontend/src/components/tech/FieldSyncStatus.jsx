import { Link } from 'react-router-dom';
import { CheckCircle2, CloudOff, Loader2, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD } from '@/config/i18n/field';
import { COMMON } from '@/config/i18n/common';
import { useT } from '@/hooks/useT';
import { queueSummary, refusalReason } from '@/helpers/fieldJob';
import { cn } from '@/helpers/utils';

/**
 * What the header says about the phone's queue (`hooks/useOfflineQueue#useOfflineQueue`): offline, syncing, how many
 * changes and photos wait — the button sends them now — or all sent. Below 400 px the words are for screen readers
 * only (the icon and the count stay), so the switch, the button and Sign out fit beside the name at 360 px.
 *
 * @param {{ sync: ReturnType<typeof import('@/hooks/useOfflineQueue').useOfflineQueue> }} props
 */
export function SyncButton({ sync }) {
  const t = useT(FIELD);
  const { count, online, syncing, syncNow } = sync;

  let icon = <CheckCircle2 aria-hidden />;
  let label = t('sync.allSent');
  if (!online) {
    icon = <CloudOff aria-hidden />;
    label = t('sync.offline');
  } else if (syncing && count) {
    icon = <Loader2 className="animate-spin" aria-hidden />;
    label = t('sync.syncing');
  } else if (count) {
    icon = <RefreshCw aria-hidden />;
    label = t('sync.syncNow');
  }

  return (
    <Button
      type="button"
      variant={count && online ? 'outline' : 'ghost'}
      size="lg"
      className={cn(
        'h-11 min-w-11 shrink-0 gap-1.5 px-2.5 min-[400px]:px-3',
        !online ? 'text-warning' : '',
        !count && online ? 'text-muted-foreground' : '',
      )}
      onClick={() => syncNow()}
      disabled={!online || syncing}
      aria-label={count ? t('sync.buttonWaiting', { label, count }) : label}
    >
      {icon}
      <span className="sr-only text-xs font-medium min-[400px]:not-sr-only">{label}</span>
      {count ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground min-[400px]:ml-0.5" aria-hidden>
          {count}
        </span>
      ) : null}
    </Button>
  );
}

/** A refused change in words: "Status “On the way”", "A photo". */
function noteWhat(note, t) {
  if (note.source === 'upload') return t(note.completes ? 'sync.kinds.signature' : 'sync.kinds.photo');
  if (note.kind === 'status') {
    const label = t.has(`status.${note.status}`) ? t(`status.${note.status}`) : note.status;
    return t('sync.kinds.status', { label });
  }
  return t.has(`sync.kinds.${note.kind}`) ? t(`sync.kinds.${note.kind}`) : note.kind;
}

/**
 * The strip under the header: no signal (and what is kept on the phone), and each change the office
 * refused for good — dropped from the queue, so it is said once here until dismissed.
 */
export function SyncBanner({ sync }) {
  const t = useT(FIELD);
  const common = useT(COMMON);
  const { online, changes, photos, notes, dismissNote } = sync;
  const what = queueSummary(t, changes, photos);

  return (
    <div aria-live="polite">
      {!online ? (
        <p className="surface-warning flex items-center gap-2 border-b px-4 py-2 text-xs font-medium">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          {what ? t('sync.offlineBanner', { what }) : t('sync.offlineBannerEmpty')}
        </p>
      ) : null}
      {notes.map((note) => {
        const reason = refusalReason(note, t, common);
        return (
          <div key={note.id} role="alert" className="flex items-start gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('sync.refusedTitle')}</p>
              <p>{reason ? t('sync.refusedLine', { what: noteWhat(note, t), reason }) : noteWhat(note, t)}</p>
              {note.jobId ? (
                <Link to={`/tech/jobs/${note.jobId}`} className="mt-0.5 inline-block font-medium underline underline-offset-2">
                  {t('today.open')}
                </Link>
              ) : note.surveyId ? (
                <Link
                  to={`/tech/surveys/${note.surveyId}${note.code === 'SURVEY_INCOMPLETE' ? '?step=checklist' : ''}`}
                  className="mt-0.5 inline-block font-medium underline underline-offset-2"
                >
                  {t('sync.openSurvey')}
                </Link>
              ) : null}
            </div>
            <Button
              type="button" variant="ghost" size="icon" className="-mr-2 -mt-1 h-10 w-10 shrink-0 text-destructive"
              onClick={() => dismissNote(note.id)} aria-label={t('sync.dismiss')}
            >
              <X />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
