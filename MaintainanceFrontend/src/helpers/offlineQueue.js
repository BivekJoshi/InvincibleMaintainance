import { clearStore, newKey, nextStamp, readAll, readOne, remove, write } from '@/helpers/fieldDb';

/**
 * The field app's mutation queue — every job change a technician makes (status, a checklist tick, a
 * material, the timer, completion) and a surveyor's offline saves, replayed through `POST /tech/sync`.
 * This is Kathmandu: connectivity drops inside the buildings we work in.
 *
 * **Everything goes through the queue, online or not** (Phase H2): a tap enqueues, and the sync engine
 * (`hooks/useOfflineQueue.js`) flushes at once when there is signal. Offline and online therefore behave
 * the same, and the screen shows the queued change straight away (`helpers/fieldJob.js#applyPending`).
 *
 * Rules:
 * - **Order** — entries replay in the order they were made: `at` and `seq` come from `fieldDb#nextStamp`,
 *   strictly increasing, and the server applies a batch sorted by `at`.
 * - **Dedupe** — an entry is stored under its `idempotencyKey`; enqueueing a key already waiting is a
 *   no-op, and the server answers a key it has applied before with `duplicate`.
 * - **Terminal refusals are dropped, not retried** — `failed` with a code in `TERMINAL_CODES`
 *   (`INVALID_TRANSITION` on a replay, a job no longer yours…) leaves the queue and is reported so the
 *   screen can say so. Any other `failed` is retried, at most `MAX_ATTEMPTS` times.
 * - **No answer is not a failure** — a network error keeps the whole queue for the next try.
 */

export const MUTATION_KINDS = [
  'status', 'task', 'material', 'time_start', 'time_stop', 'complete', 'survey_draft', 'survey_submit',
];

/**
 * A `failed` result with one of these codes will fail the same way every time. `INVALID_MUTATION` is the
 * server's word for a payload that fails its schema; `SURVEY_INCOMPLETE` (Phase L5) a submit with a required
 * answer or photo missing — the surveyor has to add it, sending it again will not help.
 */
export const TERMINAL_CODES = new Set([
  'INVALID_TRANSITION', 'UNPROCESSABLE', 'NOT_FOUND', 'FORBIDDEN', 'BAD_REQUEST', 'CONFLICT', 'VALIDATION_ERROR',
  'INVALID_MUTATION', 'SURVEY_INCOMPLETE',
]);

/** After this many refusals that were not terminal, an entry is dropped and reported anyway. */
export const MAX_ATTEMPTS = 5;

/** The most `/tech/sync` accepts in one request. */
export const BATCH_SIZE = 200;

const STORE = 'mutations';

/**
 * What a failed request means for a queued entry:
 * - `offline` — no answer (no signal, a timeout), or an answer that says "try later" (401 while the
 *   session renews, 408, 429). Keep it; do not count it.
 * - `server` — the server broke (5xx). Keep it, and count an attempt.
 * - `refused` — the server answered 4xx: sending it again will not help. Drop it and say so.
 *
 * @param {{ status?: number|string, originalStatus?: number }} error RTK Query's error shape
 * @returns {'offline'|'server'|'refused'}
 */
export function failureKind(error) {
  const status = typeof error?.status === 'number' ? error.status : error?.originalStatus;
  if (typeof status !== 'number') return 'offline';
  if (status === 401 || status === 408 || status === 429) return 'offline';
  if (status >= 500) return 'server';
  return 'refused';
}

/** The API's code and words for a failed request, for the note the screen shows. */
export const errorCode = (error) => error?.data?.error?.code ?? (typeof error?.status === 'number' ? `HTTP_${error.status}` : 'NETWORK');
export const errorMessage = (error) => error?.data?.error?.message ?? error?.error ?? error?.message ?? null;

/**
 * Adds a change to the queue.
 *
 * @param {{ kind: string, jobId?: string, surveyId?: string, taskId?: string, payload?: object,
 *           meta?: object, idempotencyKey?: string }} mutation
 *   `meta` is for the screen (a material's name and unit) and never leaves the phone.
 * @returns {Promise<string>} the idempotency key it is stored under
 */
export async function enqueue(mutation) {
  const key = mutation.idempotencyKey ?? newKey();
  if (await readOne(STORE, key)) return key;
  const { seq, at } = await nextStamp();
  await write(STORE, { payload: {}, ...mutation, idempotencyKey: key, seq, at, attempts: 0 });
  return key;
}

/** Everything waiting, oldest first. */
export const pending = () => readAll(STORE);

export const drop = (keys) => remove(STORE, keys);

/**
 * Forgets the waiting entries `predicate` picks — a change a newer one replaces in full (a survey's
 * `survey_draft`, Phase L5: each save is the whole survey, so only the newest is worth sending).
 * @param {(entry: object) => boolean} predicate
 * @returns {Promise<number>} how many were dropped
 */
export async function dropPending(predicate) {
  const stale = (await pending()).filter(predicate);
  if (stale.length) await drop(stale.map((e) => e.idempotencyKey));
  return stale.length;
}

export const clear = () => clearStore(STORE);

/** The entry as `/tech/sync` takes it — the queue's own bookkeeping (`seq`, `meta`, `attempts`) stays here. */
export function toWire(entry) {
  const { idempotencyKey, at, kind, jobId, surveyId, taskId, payload } = entry;
  return {
    idempotencyKey, at, kind, payload: payload ?? {},
    ...(jobId ? { jobId } : {}),
    ...(surveyId ? { surveyId } : {}),
    ...(taskId ? { taskId } : {}),
  };
}

/**
 * Sorts a batch by what the server answered for each entry. Pure.
 *
 * @param {object[]} batch the entries sent
 * @param {{ results?: Array<{ idempotencyKey: string, status: string, code?: string, error?: string }> }} answer
 * @returns {{ done: object[], refused: Array<{ entry: object, code: string, message: string|null, details?: any }>, retry: object[] }}
 *   `done` — applied, or applied before (`duplicate`); `refused` — to drop and report; `retry` — to keep,
 *   `attempts` already counted
 */
/** What the server listed with a refusal — a submit's missing answers (`SURVEY_INCOMPLETE`, Phase L5). */
const detailsOf = (result) => (result.details ? { details: result.details } : {});

export function settle(batch, answer) {
  const byKey = new Map((answer?.results ?? []).map((r) => [r.idempotencyKey, r]));
  const done = [];
  const refused = [];
  const retry = [];
  for (const entry of batch) {
    const result = byKey.get(entry.idempotencyKey);
    if (!result) {
      retry.push(entry); // not answered — keep it as it is
    } else if (result.status === 'applied' || result.status === 'duplicate') {
      done.push(entry);
    } else if (TERMINAL_CODES.has(result.code)) {
      refused.push({ entry, code: result.code, message: result.error ?? null, ...detailsOf(result) });
    } else {
      const attempts = (entry.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        refused.push({ entry, code: result.code ?? 'SYNC_FAILED', message: result.error ?? null, ...detailsOf(result) });
      } else {
        retry.push({ ...entry, attempts, lastError: result.error ?? null });
      }
    }
  }
  return { done, refused, retry };
}

/** The record an entry changes — entries for the same one keep their order when one of them has to wait. */
const scopeOf = (entry) => (entry.surveyId ? `survey:${entry.surveyId}` : entry.jobId ? `job:${entry.jobId}` : null);

/**
 * Sends the oldest `BATCH_SIZE` entries through `send` and settles the queue by the answer.
 *
 * `resolve` (Phase L5) prepares each entry for the wire: it may rewrite the wire shape (a survey reading's
 * `photoUploadId` → the uploaded picture's `mediaId`) or answer null — **not yet**: the entry waits, and so
 * does every later entry for the same job or survey, so a survey's submit never overtakes the save it follows.
 * Entries for other records still go.
 *
 * @param {(mutations: object[]) => Promise<{ results: object[] }>} send receives the mutation ARRAY
 *   (wire shape) — the transport wraps it as `{ mutations }`
 * @param {{ resolve?: (wire: object, entry: object) => Promise<object|null>|object|null }} [options]
 * @returns {Promise<{ sent: number, applied: object[], refused: object[], remaining: number, held: number }>}
 *   `held` — entries left waiting by `resolve`
 * @throws the transport's error when there was no answer (`failureKind(err) !== 'refused'`) — the
 *   queue is untouched, apart from a 5xx counting an attempt
 */
export async function flush(send, { resolve } = {}) {
  const queue = await pending();
  if (!queue.length) return { sent: 0, applied: [], refused: [], remaining: 0, held: 0 };
  let batch = queue.slice(0, BATCH_SIZE);
  let wire = batch.map(toWire);
  let held = 0;

  if (resolve) {
    const ready = [];
    const readyWire = [];
    const waiting = new Set();
    for (const entry of batch) {
      const scope = scopeOf(entry);
      const out = scope && waiting.has(scope) ? null : await resolve(toWire(entry), entry);
      if (out) {
        ready.push(entry);
        readyWire.push(out);
      } else {
        held += 1;
        if (scope) waiting.add(scope);
      }
    }
    batch = ready;
    wire = readyWire;
    if (!batch.length) return { sent: 0, applied: [], refused: [], remaining: queue.length, held };
  }

  let answer;
  try {
    answer = await send(wire);
  } catch (error) {
    const kind = failureKind(error);
    if (kind === 'offline') throw error;
    // The whole batch was refused (4xx) or broke the server (5xx). One bad entry fails them all, so none
    // is dropped at once — each counts an attempt, and a batch that can never be accepted stops holding
    // the queue after MAX_ATTEMPTS.
    const why = [errorCode(error), errorMessage(error)].filter(Boolean).join(': ');
    const results = batch.map((e) => ({ idempotencyKey: e.idempotencyKey, status: 'failed', code: 'BATCH_REFUSED', error: why }));
    const { refused, retry } = settle(batch, { results });
    await drop(refused.map((r) => r.entry.idempotencyKey));
    for (const entry of retry) await write(STORE, entry);
    if (kind === 'server') throw error;
    return { sent: batch.length, applied: [], refused, remaining: (await pending()).length, held };
  }

  const { done, refused, retry } = settle(batch, answer);
  await drop([...done, ...refused.map((r) => r.entry)].map((e) => e.idempotencyKey));
  for (const entry of retry) if (entry.attempts) await write(STORE, entry);

  return { sent: batch.length, applied: done, refused, remaining: (await pending()).length, held };
}
