import { addDaysTo, ktmDay } from '@/helpers/dispatchBoard';

/**
 * The field app's job rules, without a DOM: what the technician can do next, and the job as it will be
 * once the changes waiting on this phone reach the office.
 */

export const CLOSED_STATUSES = ['COMPLETED', 'VERIFIED', 'CANCELLED'];

/** The one next step from each status, so the technician never has to think. */
export const NEXT_STATUS = {
  SCHEDULED: 'EN_ROUTE',
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'IN_PROGRESS',
  ON_HOLD: 'IN_PROGRESS',
};

/** Where "Hold" is offered (`JOB_TRANSITIONS`: EN_ROUTE and IN_PROGRESS may go ON_HOLD). A reason is required. */
export const HOLDABLE = ['EN_ROUTE', 'IN_PROGRESS'];

/** The photo kinds a technician files under; the signature is taken at completion. */
export const FIELD_PHOTO_KINDS = ['BEFORE', 'DURING', 'AFTER', 'ISSUE'];

export const isClosed = (job) => CLOSED_STATUSES.includes(job?.status);

/** Checklist items neither done nor skipped — completion is refused while there are any. */
export const openTasks = (job) => (job?.tasks ?? []).filter((t) => !t.isDone && !t.isSkipped);

/** The photo kind a new picture most likely is, from where the job stands. */
export const defaultPhotoKind = (status) => (['IN_PROGRESS', 'ON_HOLD'].includes(status) ? 'DURING' : 'BEFORE');

/** A time log belongs to the technician signed in (a job can have several on it). A queued start is always theirs. */
const isMine = (log, userId) => log.pending || !userId || !log.technician?.user?.id || log.technician.user.id === userId;

/** The timer this technician has running on the job, if any. */
export const runningTimer = (job, userId) => (job?.timeLogs ?? []).find((l) => !l.endedAt && isMine(l, userId)) ?? null;

/** Minutes logged on the job so far — closed logs only. */
export const loggedMinutes = (job) => (job?.timeLogs ?? []).reduce((sum, l) => sum + (Number(l.minutes) || 0), 0);

/** The signature waiting to upload for this job — its `complete` follows it (`helpers/uploadQueue.js`). */
export const completionUpload = (uploads = [], jobId) =>
  uploads.find((u) => u.target === 'job' && u.targetId === jobId && u.then?.kind === 'complete') ?? null;

/**
 * The job as it will be once `mutations` (the queue, oldest first) are applied — the optimistic view.
 * Pure: `job` is not changed. Changes still waiting are marked `pending: true` (tasks, materials, logs) and
 * `job.pendingCount` says how many there are, unless `mark` is false (patching the cache after a sync).
 *
 * @param {object|undefined} job the server's job
 * @param {object[]} mutations queue entries, any job's
 * @param {{ userId?: string, mark?: boolean }} [options]
 */
export function applyPending(job, mutations = [], { userId, mark = true } = {}) {
  if (!job) return job;
  const mine = mutations.filter((m) => m.jobId === job.id);
  if (!mine.length) return job;
  const flag = mark ? { pending: true } : {};

  const next = {
    ...job,
    tasks: [...(job.tasks ?? [])],
    materials: [...(job.materials ?? [])],
    timeLogs: [...(job.timeLogs ?? [])],
  };

  for (const m of mine) {
    const payload = m.payload ?? {};
    switch (m.kind) {
      case 'status':
        next.status = payload.status;
        if (payload.status === 'IN_PROGRESS' && !next.actualStart) next.actualStart = m.at;
        if (payload.status === 'ON_HOLD') next.holdReason = payload.note ?? null;
        break;
      case 'task':
        next.tasks = next.tasks.map((t) => (t.id === m.taskId
          ? {
            ...t,
            ...('isDone' in payload ? { isDone: Boolean(payload.isDone), doneAt: payload.isDone ? m.at : null } : {}),
            ...('isSkipped' in payload ? { isSkipped: Boolean(payload.isSkipped) } : {}),
            ...flag,
          }
          : t));
        break;
      case 'material':
        next.materials.push({
          id: `pending:${m.idempotencyKey}`,
          qty: payload.qty,
          createdAt: m.at,
          material: m.meta?.material ?? { id: payload.materialId },
          ...flag,
        });
        break;
      case 'time_start':
        next.timeLogs.push({ id: `pending:${m.idempotencyKey}`, startedAt: m.at, endedAt: null, minutes: null, pending: true });
        break;
      case 'time_stop': {
        let index = -1;
        next.timeLogs.forEach((l, i) => { if (!l.endedAt && isMine(l, userId)) index = i; });
        if (index >= 0) {
          const log = next.timeLogs[index];
          next.timeLogs[index] = {
            ...log,
            endedAt: m.at,
            minutes: Math.max(1, Math.round((Date.parse(m.at) - Date.parse(log.startedAt)) / 60_000)),
            ...flag,
          };
        }
        break;
      }
      case 'complete':
        next.status = 'COMPLETED';
        next.actualEnd = m.at;
        next.completionNote = payload.note ?? null;
        next.customerRating = payload.customerRating ?? null;
        // The server closes every running timer on completion.
        next.timeLogs = next.timeLogs.map((l) => (l.endedAt ? l : { ...l, endedAt: m.at, ...flag }));
        break;
      default:
        break;
    }
  }
  if (!mark) {
    next.timeLogs = next.timeLogs.map((l) => {
      const log = { ...l };
      delete log.pending;
      return log;
    });
    return next;
  }
  return { ...next, pendingCount: mine.length };
}

/** A Kathmandu `YYYY-MM-DD` range ending today, `days` long. */
export function recentRange(days, today = ktmDay()) {
  return { from: addDaysTo(today, -(days - 1)), to: today };
}

/**
 * The query for "my jobs from `from` to `to`" (Kathmandu days, inclusive). `GET /tech/jobs` reads its
 * dates in the server's clock (`from` at UTC midnight, `to` to the end of the server's day), not
 * Kathmandu's, so the request asks for a day more on each side and `jobsInRange` trims the answer.
 */
export const historyQuery = ({ from, to }) => ({ from: addDaysTo(from, -1), to: addDaysTo(to, 1) });

/** The jobs scheduled on a Kathmandu day inside the range, newest first. */
export function jobsInRange(jobs = [], { from, to }) {
  return jobs
    .filter((j) => {
      if (!j.scheduledStart) return false;
      const day = ktmDay(j.scheduledStart);
      return day >= from && day <= to;
    })
    .sort((a, b) => Date.parse(b.scheduledStart) - Date.parse(a.scheduledStart));
}

/**
 * Why the office refused a queued change (a sync note, a refused submit), in the technician's language (Phase J1). In
 * English the server's own message says it most precisely ("The job was cancelled"); a technician reading Nepali gets
 * the code's words (`FIELD.errors`, then `COMMON.errors`), the server's English only for a code neither knows. Null
 * when there is nothing to say.
 *
 * @param {{ code?: string|null, message?: string|null, details?: unknown }} note
 * @param {ReturnType<typeof import('@/helpers/i18n').createT>} t a translator over `FIELD`
 * @param {ReturnType<typeof import('@/helpers/i18n').createT>} common a translator over `COMMON`, same language
 * @returns {string|null}
 */
export function refusalReason(note, t, common) {
  const code = note?.code;
  const message = note?.message ?? null;
  // A code's details (`{ maxMb: 10 }`) fill its placeholders; a list of missing answers does not.
  const vars = note?.details && typeof note.details === 'object' && !Array.isArray(note.details) ? note.details : {};
  let words = null;
  if (code && t.has(`errors.${code}`)) words = t(`errors.${code}`, vars);
  else if (code && common.has(`errors.${code}`)) words = common(`errors.${code}`, vars);
  return t.locale === 'en' ? (message ?? words) : (words ?? message);
}

/**
 * What the queue holds, in words: "3 changes and 1 photo", "1 photo", or '' for nothing.
 *
 * @param {ReturnType<typeof import('@/helpers/i18n').createT>} t a translator over `FIELD`
 * @param {number} changes
 * @param {number} photos
 */
export function queueSummary(t, changes, photos) {
  const c = changes ? t('sync.changes', { count: changes }) : '';
  const p = photos ? t('sync.photos', { count: photos }) : '';
  return c && p ? t('sync.both', { changes: c, photos: p }) : c || p;
}
