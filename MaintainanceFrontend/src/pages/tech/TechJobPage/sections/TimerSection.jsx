import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loggedMinutes, runningTimer } from '@/helpers/fieldJob';
import { formatMinutes, formatTime } from '@/helpers/format';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/**
 * The technician's timer on this job (start and stop are queued like everything else), the time logged so
 * far, and — while the work is under way — "Hold", which asks why.
 */
export function TimerSection({ job, userId, readOnly, onStart, onStop, onHold }) {
  const t = useT(FIELD);
  const running = runningTimer(job, userId);
  const minutes = loggedMinutes(job);
  if (readOnly && !minutes) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{t('job.timer.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-3 pb-4">
        {minutes ? <p className="text-sm text-muted-foreground">{t('job.timer.logged', { duration: formatMinutes(minutes, { locale: t.locale }) })}</p> : null}
        {!readOnly ? (
          running ? (
            <>
              <p className="text-sm font-medium">{t('job.timer.since', { time: formatTime(running.startedAt, { locale: t.locale }) })}</p>
              <Button variant="outline" size="xl" className="w-full" onClick={onStop}>
                <Square /> {t('job.timer.stop')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="xl" className="w-full" onClick={onStart}>
              <Play /> {t('job.timer.start')}
            </Button>
          )
        ) : null}
        {!readOnly && job.status === 'IN_PROGRESS' ? (
          <Button variant="ghost" size="lg" className="w-full" onClick={onHold}>
            <Pause /> {t('job.hold.button')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
