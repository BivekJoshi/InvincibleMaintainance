import { ArrowLeft, CloudUpload, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';
import { dayLabel, dayLabelBs } from '../siteDiary';

/**
 * Back, the job, and — on a day — the day in AD with its BS twin, and whether it waits on the phone or has changes not
 * saved yet.
 *
 * @param {{ job?: object, day?: string, waiting?: boolean, dirty?: boolean, onBack: () => void, backLabel?: string }} props
 */
export function DiaryHeader({ job, day, waiting = false, dirty = false, onBack, backLabel }) {
  const t = useT(FIELD);
  const { locale } = t;
  const bs = day ? dayLabelBs(day, locale) : '';
  return (
    <div className="mb-4 flex items-start gap-2">
      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onBack} aria-label={backLabel ?? t('diary.backToDays')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-muted-foreground">
          {job?.number ?? ''}{job?.title ? ` · ${job.title}` : ''}
        </p>
        <h1 className="font-semibold leading-tight">
          {t('diary.title')}
          {day ? <span className="block text-base" data-testid="diary-day">{dayLabel(day, locale)}</span> : null}
        </h1>
        {bs ? <p className="text-xs text-muted-foreground" lang={locale}>{bs}</p> : null}
        {waiting || dirty ? (
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {waiting ? (
              <span className="inline-flex items-center gap-1" data-testid="diary-waiting">
                <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {t('diary.waiting')}
              </span>
            ) : null}
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <PencilLine className="h-3.5 w-3.5" aria-hidden /> {t('diary.unsaved')}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
