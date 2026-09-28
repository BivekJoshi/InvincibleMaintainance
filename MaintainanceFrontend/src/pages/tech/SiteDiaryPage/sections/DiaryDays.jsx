import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CalendarDays, ChevronRight, CloudUpload, NotebookPen } from 'lucide-react';
import { useGetMyDiaryQuery, useGetMyJobQuery } from '@/api/techApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { PageTransition } from '@/three/motion/motionKit';
import { useFieldCopy } from '@/hooks/useFieldCopy';
import { ktmDay } from '@/helpers/dispatchBoard';
import { selectFieldMutations } from '@/redux/slices/fieldSyncSlice';
import { selectLocale } from '@/redux/slices/uiSlice';
import { dayLabel, dayLabelBs, diaryClosed, diaryDayBounds, isDiaryDay, waitingDays } from '../siteDiary';
import { DiaryHeader } from './DiaryHeader';

/**
 * `/tech/jobs/:id/diary` — the days filed for this job, newest first (the server's, with the days still waiting on the
 * phone marked), today on top with one big button, and "Another day" for a day that was missed (up to 60 back).
 * Today is the server's Kathmandu day, or the phone's with no signal.
 */
export function DiaryDays({ jobId }) {
  const navigate = useNavigate();
  const copy = useFieldCopy();
  const words = copy.diary;
  const locale = useSelector(selectLocale);
  const mutations = useSelector(selectFieldMutations);
  const { data: job } = useGetMyJobQuery(jobId);
  const { data, isLoading, error, refetch } = useGetMyDiaryQuery(jobId);
  const today = data?.today ?? ktmDay();
  const [other, setOther] = useState('');

  if (error && !data && navigator.onLine !== false) return <PageTransition><ErrorState error={error} onRetry={refetch} /></PageTransition>;
  if (isLoading) return <PageTransition><CardSkeleton /></PageTransition>;

  const waiting = waitingDays(mutations, jobId);
  const served = data?.days ?? [];
  const days = [...new Set([...served.map((d) => d.day), ...waiting])].sort().reverse();
  const byDay = new Map(served.map((d) => [d.day, d]));
  const todayFiled = byDay.has(today) || waiting.includes(today);
  const bounds = diaryDayBounds(today);
  const otherOk = isDiaryDay(other, today);
  const closed = diaryClosed(job);

  return (
    <PageTransition>
      <DiaryHeader job={job} words={words} locale={locale} onBack={() => navigate(`/tech/jobs/${jobId}`)} backLabel={words.back} />

      {closed ? <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{words.closed}</p> : null}

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{words.today}</p>
                <p className="font-semibold" data-testid="diary-today">{dayLabel(today)}</p>
                <p className="text-xs text-muted-foreground" lang={locale}>{dayLabelBs(today, locale)}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {waiting.includes(today) ? words.waiting : byDay.has(today) ? words.filed : words.notFiled}
              </span>
            </div>
            <Button asChild size="xl" className="w-full">
              <Link to={`/tech/jobs/${jobId}/diary/${today}`}>
                <NotebookPen aria-hidden /> {todayFiled || closed ? words.openToday : words.fillToday}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {!closed ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <Label htmlFor="diary-other-day" className="text-base font-semibold">{words.otherDay}</Label>
              <p className="text-xs text-muted-foreground">{words.otherDayHint}</p>
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <Input
                  id="diary-other-day"
                  type="date"
                  min={bounds.min}
                  max={bounds.max}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  aria-invalid={other && !otherOk ? true : undefined}
                  className="h-12 flex-1 text-base"
                />
                <Button
                  type="button" variant="outline" className="h-12 shrink-0 whitespace-normal" disabled={!otherOk}
                  onClick={() => navigate(`/tech/jobs/${jobId}/diary/${other}`)}
                >
                  <CalendarDays aria-hidden /> {words.openDay}
                </Button>
              </div>
              {other && !otherOk ? <p className="text-sm text-destructive">{words.badDay}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{words.days}</CardTitle></CardHeader>
          <CardContent className="pb-4">
            {!days.length ? <p className="text-sm text-muted-foreground">{words.noDays}</p> : (
              <ul className="space-y-2" aria-label={words.days}>
                {days.map((day) => {
                  const d = byDay.get(day);
                  const facts = [
                    d?.weather ? words.weather[d.weather] : null,
                    d?.headcountTotal ? words.crew(d.headcountTotal) : null,
                    d?.lostHours ? words.lostShort(d.lostHours) : null,
                  ].filter(Boolean);
                  return (
                    <li key={day}>
                      <Link
                        to={`/tech/jobs/${jobId}/diary/${day}`}
                        className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2 active:bg-muted"
                        data-testid={`diary-day-${day}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{dayLabel(day)}</span>
                          {facts.length ? <span className="block truncate text-xs text-muted-foreground">{facts.join(' · ')}</span> : null}
                          {waiting.includes(day) ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {words.waiting}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
