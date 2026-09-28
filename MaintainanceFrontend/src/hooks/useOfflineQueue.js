import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { current } from '@reduxjs/toolkit';
import { techApi } from '@/api/techApi';
import { newKey } from '@/helpers/fieldDb';
import { dropPending, enqueue, failureKind, flush, pending } from '@/helpers/offlineQueue';
import { addUpload, describeUpload, drainUploads, getUpload, pendingUploads } from '@/helpers/uploadQueue';
import { applyPending } from '@/helpers/fieldJob';
import { mediaIdForUpload, rememberSent } from '@/helpers/sentPhotos';
import {
  fieldNoteDismissed, fieldNotesAdded, fieldOnlineChanged, fieldQueueLoaded, fieldSyncFinished, fieldSyncStarted,
  selectFieldSync,
} from '@/redux/slices/fieldSyncSlice';

/**
 * The field app's sync engine — the one place the two on-device queues meet the API.
 *
 * `useOfflineQueue()` is mounted once, by `TechLayout`: it loads the queues into the store, and syncs on
 * start, when the phone comes back online, when the app comes back to the foreground, every
 * `SYNC_RETRY_MS` while something waits, and on "Sync now". `useFieldQueue()` is what a screen calls:
 * it queues a change or a picture and, when there is signal, syncs at once — so online and offline take
 * the same path, and the screen shows the change from the queue (`helpers/fieldJob.js#applyPending`).
 *
 * One sync runs at a time (a second request while one runs makes it go round again), in three steps:
 *   1. the mutations queued so far (`POST /tech/sync`, oldest first);
 *   2. the uploads, oldest first — a signature's upload queues its `complete` with the media id;
 *   3. the mutations again, which sends that `complete` after everything that was queued before it.
 * No answer (offline) stops the sync and keeps everything. What the server refused for good leaves the
 * queue and becomes a note the header shows.
 *
 * A survey reading may wait for its photo (Phase L5): it names the upload (`photoUploadId`) and is sent with
 * the picture's `mediaId` once step 2 has uploaded it (`resolveSurveyPhotos`); until then that survey's saves
 * and its submit wait together, in order, so step 3 sends them.
 */

export const SYNC_RETRY_MS = 30_000;

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let loadSeq = 0;

/** Mirrors both queues into the store (an upload without its picture). Only the newest read is kept. */
export async function loadFieldQueue(dispatch) {
  loadSeq += 1;
  const mine = loadSeq;
  let mutations = [];
  let uploads = [];
  try {
    [mutations, uploads] = await Promise.all([pending(), pendingUploads()]);
  } catch {
    // no storage at all — nothing can be waiting
  }
  if (mine === loadSeq) dispatch(fieldQueueLoaded({ mutations, uploads: uploads.map(describeUpload) }));
}

const note = (source, { entry, code, message, details }) => ({
  id: newKey(),
  source,
  kind: entry.kind ?? null,
  status: entry.payload?.status ?? null,
  jobId: entry.jobId ?? (entry.target === 'job' ? entry.targetId : null),
  surveyId: entry.surveyId ?? (entry.target === 'survey' ? entry.targetId : null),
  completes: entry.then?.kind === 'complete',
  code: code ?? null,
  message: message ?? null,
  // A survey submit's SURVEY_INCOMPLETE names what is missing, when the server says (Phase L5).
  details: Array.isArray(details) ? details : null,
  at: new Date().toISOString(),
});

/**
 * A survey save or submit on its way to the wire: each reading's `photoUploadId` becomes the uploaded
 * picture's `mediaId`. Null — hold it — while the picture is still in the upload queue; a picture that will
 * never arrive (refused) is left off the reading, and the server's submit check says what is missing.
 * Anything else passes untouched.
 *
 * @param {object} wire the entry as `/tech/sync` takes it
 * @returns {Promise<object|null>}
 */
export async function resolveSurveyPhotos(wire) {
  const readings = wire.payload?.readings;
  if (!Array.isArray(readings) || !readings.some((r) => r?.photoUploadId)) return wire;
  const out = [];
  for (const reading of readings) {
    if (!reading?.photoUploadId) {
      out.push(reading);
      continue;
    }
    const { photoUploadId, ...rest } = reading;
    const mediaId = mediaIdForUpload(photoUploadId);
    if (mediaId) out.push({ ...rest, mediaId });
    else if (await getUpload(photoUploadId)) return null;
    else out.push(rest);
  }
  return { ...wire, payload: { ...wire.payload, readings: out } };
}

/** Writes applied changes into the cached job and today's list, so nothing flickers back before the refetch. */
function patchCaches(dispatch, applied) {
  const byJob = new Map();
  for (const entry of applied) {
    if (!entry.jobId) continue;
    byJob.set(entry.jobId, [...(byJob.get(entry.jobId) ?? []), entry]);
  }
  for (const [jobId, entries] of byJob) {
    dispatch(techApi.util.updateQueryData('getMyJob', jobId, (draft) => applyPending(current(draft), entries, { mark: false })));
    dispatch(techApi.util.updateQueryData('getMyJobsToday', undefined, (draft) =>
      current(draft).map((job) => (job.id === jobId ? applyPending(job, entries, { mark: false }) : job))));
  }
}

async function sendUpload(dispatch, entry) {
  const body = new FormData();
  // Text fields before the file, so the server has them whatever order it reads in. A survey photo without a
  // kind is filed as ISSUE by the API; SKETCH (Phase L5) is sent as such, and so is its area.
  if (entry.kind) body.append('kind', entry.kind);
  if (entry.caption) body.append('caption', entry.caption);
  if (entry.area) body.append('area', entry.area);
  body.append('files', entry.file, entry.name ?? 'photo.jpg');
  const endpoint = entry.target === 'survey' ? techApi.endpoints.uploadSurveyPhotos : techApi.endpoints.uploadMyJobPhotos;
  const answer = await dispatch(endpoint.initiate({ id: entry.targetId, body })).unwrap();
  // Remembered before the queue forgets the upload, so a reading waiting for this picture finds its id.
  rememberSent(describeUpload(entry), answer?.media);
  return answer;
}

/** Step 1 and 3: flush the mutation queue until it is empty or stops moving. Throws when offline. */
async function flushMutations(dispatch, touched, notes) {
  for (let round = 0; round < 20; round += 1) {
    let result;
    try {
      result = await flush(
        (batch) => dispatch(techApi.endpoints.syncOffline.initiate(batch)).unwrap(),
        { resolve: resolveSurveyPhotos },
      );
    } catch (error) {
      if (failureKind(error) === 'offline') throw error;
      return; // the server broke — the uploads may still go
    }
    if (!result.sent) return;
    patchCaches(dispatch, result.applied);
    for (const entry of result.applied) touched.add(entry);
    for (const refusal of result.refused) {
      touched.add(refusal.entry);
      notes.push(note('mutation', refusal));
    }
    const progress = result.applied.length + result.refused.length;
    if (!result.remaining || !progress) return;
  }
}

function invalidate(dispatch, touched) {
  const tags = new Map();
  const add = (type, id) => tags.set(`${type}:${id}`, { type, id });
  for (const entry of touched) {
    const jobId = entry.jobId ?? (entry.target === 'job' ? entry.targetId : null);
    const surveyId = entry.surveyId ?? (entry.target === 'survey' ? entry.targetId : null);
    if (jobId) {
      add('Job', jobId);
      add('Job', 'TECH_TODAY');
      add('Job', 'TECH_LIST');
    }
    if (surveyId) {
      add('Survey', surveyId);
      add('Survey', 'TECH_LIST');
    }
  }
  if (tags.size) dispatch(techApi.util.invalidateTags([...tags.values()]));
}

async function syncOnce(dispatch) {
  if (!isOnline()) return;
  dispatch(fieldSyncStarted());
  const touched = new Set();
  const notes = [];
  try {
    await flushMutations(dispatch, touched, notes);
    const drained = await drainUploads((entry) => sendUpload(dispatch, entry), { followUp: (mutation) => enqueue(mutation) });
    for (const { entry } of drained.sent) touched.add(entry);
    for (const refusal of drained.refused) {
      touched.add(refusal.entry);
      notes.push(note('upload', refusal));
    }
    await flushMutations(dispatch, touched, notes);
  } catch {
    // No signal part-way through: whatever did not go stays queued for the next try.
  } finally {
    await loadFieldQueue(dispatch);
    if (notes.length) dispatch(fieldNotesAdded(notes));
    dispatch(fieldSyncFinished({ at: new Date().toISOString() }));
    invalidate(dispatch, touched);
  }
}

let inFlight = null;
let again = false;

/**
 * Runs a sync, or — if one is running — makes it go round once more when it ends, so a change queued
 * mid-sync is not left waiting for the next trigger. Resolves when the queue has been through the server.
 *
 * @param {import('@reduxjs/toolkit').Dispatch} dispatch
 * @returns {Promise<void>}
 */
export function syncFieldQueue(dispatch) {
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        again = false;
        await syncOnce(dispatch);
      } while (again && isOnline());
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Tests only: wait for a sync a screen started without awaiting it. */
export const fieldSyncSettled = () => inFlight ?? Promise.resolve();

/**
 * The shell's side: mounted once by `TechLayout`. Loads the queues and keeps them moving.
 *
 * @returns {{ count: number, changes: number, photos: number, online: boolean, syncing: boolean,
 *   notes: object[], lastSyncedAt: string|null, syncNow: () => Promise<void>, dismissNote: (id: string) => void }}
 */
export function useOfflineQueue() {
  const dispatch = useDispatch();
  const { mutations, uploads, online, syncing, notes, lastSyncedAt } = useSelector(selectFieldSync);

  useEffect(() => {
    let alive = true;
    dispatch(fieldOnlineChanged(isOnline()));
    loadFieldQueue(dispatch).then(() => {
      if (alive && isOnline()) syncFieldQueue(dispatch);
    });
    const goOnline = () => {
      dispatch(fieldOnlineChanged(true));
      syncFieldQueue(dispatch);
    };
    const goOffline = () => dispatch(fieldOnlineChanged(false));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isOnline()) syncFieldQueue(dispatch);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dispatch]);

  const count = mutations.length + uploads.length;

  // A 5xx or a flaky connection that still reports "online": try again on a beat while anything waits.
  useEffect(() => {
    if (!count || !online) return undefined;
    const timer = setInterval(() => syncFieldQueue(dispatch), SYNC_RETRY_MS);
    return () => clearInterval(timer);
  }, [count, online, dispatch]);

  const syncNow = useCallback(() => syncFieldQueue(dispatch), [dispatch]);
  const dismissNote = useCallback((id) => dispatch(fieldNoteDismissed(id)), [dispatch]);

  return {
    count, changes: mutations.length, photos: uploads.length, online, syncing, notes, lastSyncedAt, syncNow, dismissNote,
  };
}

/**
 * A screen's side: queue a change or a picture. Both resolve once it is safely on the phone; the sync
 * that follows (when there is signal) is not awaited — the screen has already moved on.
 */
export function useFieldQueue() {
  const dispatch = useDispatch();

  /**
   * @param {{ kind: string, jobId?: string, surveyId?: string, taskId?: string, payload?: object, meta?: object }} mutation
   * @param {{ supersede?: (entry: object) => boolean }} [options] waiting entries this one replaces in full — dropped
   *   first (a survey's older `survey_draft`)
   */
  const queueMutation = useCallback(async (mutation, { supersede } = {}) => {
    if (supersede) await dropPending(supersede);
    const key = await enqueue(mutation);
    await loadFieldQueue(dispatch);
    if (isOnline()) syncFieldQueue(dispatch);
    return key;
  }, [dispatch]);

  /** @param {{ target: 'job'|'survey', targetId: string, kind?: string, caption?: string, area?: string, file: Blob, name?: string, then?: object }} upload */
  const queueUpload = useCallback(async (upload) => {
    const entry = await addUpload(upload);
    await loadFieldQueue(dispatch);
    if (isOnline()) syncFieldQueue(dispatch);
    return describeUpload(entry);
  }, [dispatch]);

  const syncNow = useCallback(() => syncFieldQueue(dispatch), [dispatch]);

  return { queueMutation, queueUpload, syncNow };
}
