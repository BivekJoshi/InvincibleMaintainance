/**
 * A durable queue of field mutations, so a survey filled in with no signal is not
 * lost. This is Kathmandu — connectivity drops inside the buildings we survey.
 *
 * Entries are replayed through POST /tech/sync, which de-dupes on idempotencyKey,
 * so a queue flushed twice is harmless. Storage is IndexedDB rather than
 * localStorage because a survey with photos and forty lines outgrows 5MB.
 */

const DB_NAME = 'gharjatan-field';
const STORE = 'mutations';
const VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'idempotencyKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** crypto.randomUUID is unavailable on http:// origins in some browsers. */
const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

/**
 * @param {{ kind: string, surveyId?: string, jobId?: string, taskId?: string, payload?: object }} mutation
 * @returns {Promise<string>} the idempotency key it was stored under
 */
export async function enqueue(mutation) {
  const entry = {
    idempotencyKey: newKey(),
    at: new Date().toISOString(),
    payload: {},
    ...mutation,
  };
  await tx('readwrite', (store) => store.put(entry));
  return entry.idempotencyKey;
}

export async function pending() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(
      // Replay in the order the surveyor made them.
      request.result.sort((a, b) => new Date(a.at) - new Date(b.at)),
    );
    request.onerror = () => reject(request.error);
  });
}

export async function drop(keys) {
  if (!keys.length) return;
  await tx('readwrite', (store) => keys.forEach((k) => store.delete(k)));
}

export async function clear() {
  await tx('readwrite', (store) => store.clear());
}

/**
 * Flushes the queue through /tech/sync.
 *
 * A mutation is dropped when the server applied it, when it says duplicate, and
 * when it fails with a terminal code — a survey the office already took over
 * would otherwise be retried forever. Anything else stays queued.
 *
 * @param {(mutations: object[]) => Promise<{ results: Array<{idempotencyKey: string, status: string, code?: string}> }>} send
 *        Receives the mutation ARRAY — the transport wraps it as { mutations }.
 */
const TERMINAL = new Set(['INVALID_TRANSITION', 'UNPROCESSABLE', 'NOT_FOUND', 'FORBIDDEN', 'BAD_REQUEST']);

export async function flush(send) {
  const queue = await pending();
  if (!queue.length) return { applied: 0, dropped: 0, remaining: 0 };

  const result = await send(queue.slice(0, 200));
  const settled = (result?.results ?? []).filter(
    (r) => r.status === 'applied' || r.status === 'duplicate' || TERMINAL.has(r.code),
  );
  await drop(settled.map((r) => r.idempotencyKey));

  return {
    applied: (result?.results ?? []).filter((r) => r.status === 'applied').length,
    dropped: settled.length,
    remaining: (await pending()).length,
  };
}
