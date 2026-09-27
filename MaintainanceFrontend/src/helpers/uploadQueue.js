import { newKey, nextStamp, readAll, readOne, remove, write } from '@/helpers/fieldDb';
import { MAX_ATTEMPTS, errorCode, errorMessage, failureKind } from '@/helpers/offlineQueue';

/**
 * Photos and signatures waiting for signal — the field app's second queue, beside `offlineQueue.js`.
 *
 * Every picture goes in here first, online or not, and the sync engine (`hooks/useOfflineQueue.js`)
 * sends it at once when it can. Photos are append-only on the server, so they never conflict; the rules
 * are about order and about not losing one:
 *
 * - **In order** — oldest first (`at`, `seq` from `fieldDb#nextStamp`). The first upload that gets no
 *   answer stops the drain, so a later photo never overtakes an earlier one.
 * - **Retry** — no answer (offline) keeps the entry, uncounted; a 5xx counts an attempt and stops the
 *   drain; after `MAX_ATTEMPTS` it is dropped and reported. A 4xx (not a picture, the job is no longer
 *   yours) is dropped and reported at once.
 * - **A follow-up waits for its upload** — an entry may carry `then`, a mutation that needs the uploaded
 *   media's id. The signature carries `{ kind: 'complete', jobId, payload }`: `complete` is enqueued only
 *   after the signature is on the server, with `payload.signatureMediaId` set to its id, and so it replays
 *   after every change made before it. `then.idempotencyKey` is fixed when the signature is queued, so a
 *   follow-up enqueued twice (a crash between the two writes) is still one completion.
 */

const STORE = 'uploads';

/**
 * @typedef {object} UploadEntry
 * @property {string} id
 * @property {'job'|'survey'} target
 * @property {string} targetId
 * @property {string} [kind] a job photo's kind — BEFORE | DURING | AFTER | ISSUE | SIGNATURE
 * @property {string} [caption]
 * @property {Blob} file
 * @property {string} [name]
 * @property {{ kind: string, jobId: string, payload: object, idempotencyKey: string }} [then]
 */

/**
 * @param {{ target: 'job'|'survey', targetId: string, kind?: string, caption?: string, file: Blob,
 *           name?: string, then?: object }} upload
 * @returns {Promise<UploadEntry>}
 */
export async function addUpload({ target, targetId, kind, caption, file, name, then }) {
  const { seq, at } = await nextStamp();
  const entry = {
    id: newKey(),
    seq,
    at,
    target,
    targetId,
    ...(kind ? { kind } : {}),
    ...(caption?.trim() ? { caption: caption.trim() } : {}),
    file,
    name: name ?? file?.name ?? 'photo.jpg',
    size: file?.size ?? 0,
    ...(then ? { then: { idempotencyKey: newKey(), ...then } } : {}),
    attempts: 0,
    lastError: null,
  };
  await write(STORE, entry);
  return entry;
}

/** Everything waiting, oldest first — with the pictures. */
export const pendingUploads = () => readAll(STORE);

export const getUpload = (id) => readOne(STORE, id);

export const removeUpload = (id) => remove(STORE, id);

/** An entry without its bytes — what the store and the screen hold. */
export function describeUpload(entry) {
  const { file, ...rest } = entry;
  return { ...rest, size: entry.size ?? file?.size ?? 0 };
}

/**
 * Sends the waiting uploads, oldest first.
 *
 * @param {(entry: UploadEntry) => Promise<{ photos?: object[], media?: Array<{ id: string }> }>} send
 * @param {{ followUp?: (mutation: object) => Promise<unknown> }} [options]
 *   `followUp` enqueues an entry's `then` once its upload succeeded (`offlineQueue#enqueue`)
 * @returns {Promise<{ sent: Array<{ entry: object, answer: object }>, refused: Array<{ entry: object, code: string, message: string|null }>,
 *   stopped: boolean, followUps: number }>} `stopped` — an upload got no answer; the rest wait with it
 */
export async function drainUploads(send, { followUp } = {}) {
  const sent = [];
  const refused = [];
  let followUps = 0;

  for (const entry of await pendingUploads()) {
    let answer;
    try {
      answer = await send(entry);
    } catch (error) {
      const kind = failureKind(error);
      if (kind === 'offline') {
        return { sent, refused, stopped: true, followUps };
      }
      const attempts = (entry.attempts ?? 0) + 1;
      if (kind === 'server' && attempts < MAX_ATTEMPTS) {
        await write(STORE, { ...entry, attempts, lastError: errorMessage(error) });
        return { sent, refused, stopped: true, followUps };
      }
      await removeUpload(entry.id);
      refused.push({ entry: describeUpload(entry), code: errorCode(error), message: errorMessage(error) });
      continue;
    }

    if (entry.then) {
      const mediaId = answer?.media?.[0]?.id;
      if (mediaId) {
        // Queue the follow-up BEFORE forgetting the upload: a crash in between repeats the upload and the
        // enqueue, and the fixed idempotency key makes the second enqueue a no-op.
        await followUp?.({ ...entry.then, payload: { ...entry.then.payload, signatureMediaId: mediaId } });
        followUps += 1;
      } else {
        refused.push({ entry: describeUpload(entry), code: 'NO_MEDIA', message: 'The server kept no picture' });
      }
    }
    await removeUpload(entry.id);
    sent.push({ entry: describeUpload(entry), answer });
  }

  return { sent, refused, stopped: false, followUps };
}
