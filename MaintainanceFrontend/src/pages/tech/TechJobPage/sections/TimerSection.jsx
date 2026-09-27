import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loggedMinutes, runningTimer } from '@/helpers/fieldJob';
import { formatMinutes, formatTime } from '@/helpers/format';

/**
 * The technician's timer on this job (start and stop are queued like everything else), the time logged so
 * far, and — while the work is under way — "Hold", which asks why.
 */
export function TimerSection({ job, copy, userId, readOnly, onStart, onStop, onHold }) {
  const words = copy.job.timer;
  const running = runningTimer(job, userId);
  const minutes = loggedMinutes(job);
  if (readOnly && !minutes) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{words.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 pb-4">
        {minutes ? <p className="text-sm text-muted-foreground">{words.logged(formatMinutes(minutes))}</p> : null}
        {!readOnly ? (
          running ? (
            <>
              <p className="text-sm font-medium">{words.since(formatTime(running.startedAt))}</p>
              <Button variant="outline" size="xl" className="w-full" onClick={onStop}>
                <Square /> {words.stop}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="xl" className="w-full" onClick={onStart}>
              <Play /> {words.start}
            </Button>
          )
        ) : null}
        {!readOnly && job.status === 'IN_PROGRESS' ? (
          <Button variant="ghost" size="lg" className="w-full" onClick={onHold}>
            <Pause /> {copy.job.hold.button}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
