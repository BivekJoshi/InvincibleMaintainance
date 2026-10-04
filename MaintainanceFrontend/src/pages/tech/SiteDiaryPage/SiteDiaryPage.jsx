import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2, Save } from 'lucide-react';
import { useGetMyDiaryDayQuery, useGetMyJobQuery } from '@/api/techApi';
import { FieldErrorState } from '@/components/tech/FieldErrorState';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { useFieldQueue } from '@/hooks/useOfflineQueue';
import { useT } from '@/hooks/useT';
import { FIELD } from '@/config/i18n/field';
import { mediaIdForUpload } from '@/helpers/sentPhotos';
import { pending } from '@/helpers/offlineQueue';
import { selectFieldSync } from '@/redux/slices/fieldSyncSlice';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { DiaryDays } from './sections/DiaryDays';
import { DiaryHeader } from './sections/DiaryHeader';
import { WeatherCard } from './sections/WeatherCard';
import { HeadcountCard } from './sections/HeadcountCard';
import { ProgressCard } from './sections/ProgressCard';
import { ReceivedCard } from './sections/ReceivedCard';
import { LostTimeCard } from './sections/LostTimeCard';
import { DiaryPhotos } from './sections/DiaryPhotos';
import { NotesCard } from './sections/NotesCard';
import {
  diaryClosed, diaryPayload, diaryProblems, diaryToForm, hasProblems, isDiarySave, waitingPhotoIds,
} from './siteDiary';

const online = () => navigator.onLine !== false;

/**
 * The foreman's site diary (Phase L7) — `/tech/jobs/:id/diary` lists the days filed and opens today;
 * `/tech/jobs/:id/diary/:day` is one Kathmandu day: the weather, who was on site per trade, progress per line of the
 * job's BOQ (steps of 5 %), materials received with the challan number, problems, lost hours with the reason, the
 * day's photos and a note. Built for 360 px and gloves: every control is at least 44 px, the save is pinned at the
 * bottom. English and Nepali (`FIELD.diary`).
 *
 * **Every write is a `diary_save`** through the field queue (`useFieldQueue`), online or not: the whole day, a full
 * replace keyed on the job and the day, so replaying it lands on the same state; a newer save of the same day replaces
 * one still waiting (`supersede`). The form as typed rides in the entry's `meta` (never sent), so coming back before
 * it is sent shows what was typed. Photos go through the upload queue as the job's DURING photos; the save names them
 * by their upload (`meta.photoUploadIds`) and the sync engine sends their media ids once they are up.
 *
 * **No money** (D1): a line is its number, words and quantity — the API sends no rate, and nothing here asks for one.
 */
export default function SiteDiaryPage() {
  const { id, day } = useParams();
  return day ? <DiaryDay key={`${id}:${day}`} jobId={id} day={day} /> : <DiaryDays jobId={id} />;
}

function DiaryDay({ jobId, day }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useT(FIELD);
  const { data: job } = useGetMyJobQuery(jobId);
  const { data, isLoading, error, refetch } = useGetMyDiaryDayQuery({ jobId, day });
  const { queueMutation } = useFieldQueue();
  const { mutations, uploads } = useSelector(selectFieldSync);

  const [form, setForm] = useState(null);
  const [problems, setProblems] = useState({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  const readOnly = diaryClosed(job);

  // The form starts from the newest save of this day still waiting on the phone, else from the server's day.
  useEffect(() => {
    if (!data || form) return undefined;
    let alive = true;
    const start = (next) => {
      if (!alive) return;
      formRef.current = next;
      setForm(next);
    };
    pending()
      .then((queue) => {
        const waiting = [...queue].reverse().find((e) => isDiarySave(jobId, day)(e) && e.meta?.form);
        start(waiting ? { ...diaryToForm(data.entry), ...waiting.meta.form } : diaryToForm(data.entry));
      })
      .catch(() => start(diaryToForm(data.entry)));
    return () => { alive = false; };
  }, [data, form, jobId, day]);

  const change = useCallback((updater) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      formRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  /** Queues the day as it stands, replacing a save of the same day still waiting. Quietly skipped when it cannot be saved. */
  const saveNow = useCallback(async ({ quiet = false } = {}) => {
    const current = formRef.current;
    if (!current || readOnly) return false;
    const found = diaryProblems(current);
    if (hasProblems(found)) {
      if (!quiet) {
        setProblems(found);
        dispatch(toastError(t('diary.fix')));
      }
      return false;
    }
    setProblems({});
    await queueMutation(
      {
        kind: 'diary_save',
        jobId,
        payload: diaryPayload(current, day),
        meta: { form: current, photoUploadIds: waitingPhotoIds(current) },
      },
      { supersede: isDiarySave(jobId, day) },
    );
    dirtyRef.current = false;
    setDirty(false);
    return true;
  }, [day, dispatch, jobId, queueMutation, readOnly, t]);

  // Leaving the screen, or the phone locking, keeps what was typed — when it can be saved as it is.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && dirtyRef.current) saveNow({ quiet: true }); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (dirtyRef.current) saveNow({ quiet: true });
    };
  }, [saveNow]);

  // A photo that has reached the server: keep its media id on the form (the waiting save is resolved by the engine).
  useEffect(() => {
    const current = formRef.current;
    if (!current) return;
    let swapped = false;
    const photos = current.photos.map((p) => {
      if (!p.uploadId || p.mediaId || uploads.some((u) => u.id === p.uploadId)) return p;
      const mediaId = mediaIdForUpload(p.uploadId);
      if (!mediaId) return p;
      swapped = true;
      return { _key: p._key, mediaId };
    });
    if (swapped) {
      const next = { ...current, photos };
      formRef.current = next;
      setForm(next);
    }
  }, [uploads]);

  // With no signal a refetch fails, but a day already on the phone is still the one to work from.
  if (error && !data) {
    return (
      <PageTransition>
        <DiaryHeader job={job} day={day} onBack={() => navigate(`/tech/jobs/${jobId}/diary`)} />
        {online() && typeof error?.status === 'number'
          ? <FieldErrorState error={error} onRetry={refetch} />
          : <FieldErrorState message={t('diary.notLoaded')} onRetry={refetch} />}
      </PageTransition>
    );
  }
  if (isLoading || !form) return <PageTransition><CardSkeleton /></PageTransition>;

  const waiting = mutations.some(isDiarySave(jobId, day));

  const onSave = async () => {
    setSaving(true);
    try {
      const ok = await saveNow();
      if (!ok) return;
      dispatch(online()
        ? toastSuccess(t('diary.saved'), t('diary.savedBody'))
        : toastSuccess(t('diary.savedOffline'), t('diary.savedOfflineBody')));
    } catch (err) {
      dispatch(toastError(t('couldNotSave'), err?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <DiaryHeader
        job={job}
        day={day}
        waiting={waiting}
        dirty={dirty}
        onBack={() => navigate(`/tech/jobs/${jobId}/diary`)}
      />

      {readOnly ? <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t('diary.closed')}</p> : null}

      <div className="space-y-4" data-testid="site-diary-day">
        <WeatherCard value={form.weather} onChange={(weather) => change({ weather })} readOnly={readOnly} />
        <HeadcountCard
          trades={data.trades ?? []}
          headcount={form.headcount}
          onChange={(headcount) => change({ headcount })}
          readOnly={readOnly}
        />
        <ProgressCard
          lines={data.lines ?? []}
          progress={form.progress}
          onChange={(progress) => change({ progress })}
          readOnly={readOnly}
        />
        <ReceivedCard
          rows={form.received}
          onChange={(received) => change({ received })}
          problems={problems.received}
          readOnly={readOnly}
        />
        <LostTimeCard
          hours={form.lostHours}
          reason={form.lostReason}
          onChange={(patch) => change(patch)}
          problems={problems}
          readOnly={readOnly}
        />
        <DiaryPhotos
          jobId={jobId}
          day={day}
          photos={form.photos}
          media={job?.media}
          onChange={(photos) => change({ photos })}
          problem={problems.photos}
          readOnly={readOnly}
        />
        <NotesCard issues={form.issues} note={form.note} onChange={(patch) => change(patch)} readOnly={readOnly} />
      </div>

      {!readOnly ? (
        <div
          className="sticky bottom-20 z-10 mt-4 rounded-lg border bg-background/95 p-3 backdrop-blur"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Button type="button" size="xl" className="w-full" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} {t('diary.save')}
          </Button>
        </div>
      ) : null}
    </PageTransition>
  );
}
