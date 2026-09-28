/**
 * The field app's storage on the phone: one IndexedDB database holding two queues.
 *
 * - `mutations` — job and survey changes waiting for `POST /tech/sync`, keyed by `idempotencyKey`
 *   (`helpers/offlineQueue.js`).
 * - `uploads` — photos and signatures waiting for signal, keyed by `id`, the picture kept as a Blob
 *   (`helpers/uploadQueue.js`).
 *
 * IndexedDB rather than localStorage because a day of photos outgrows 5 MB, and because a Blob can be
 * stored as it is. Where IndexedDB is missing or refuses to open (a private window, jsdom) the same calls
 * run against memory: the app keeps working, it simply forgets the queue on a reload.
 *
 * Every entry in either queue carries a `seq` and an `at` from `nextStamp()`, both strictly increasing on
 * this device, so the two queues sort the way the technician acted — even two taps in one millisecond.
 */

const DB_NAME = 'gharjatan-field';
/** v1 held `mutations` only; v2 (Phase H2) adds `uploads`. */
const VERSION = 2;

/** Store name → its key path. */
export const FIELD_STORES = { mutations: 'idempotencyKey', uploads: 'id' };

let dbPromise = null;
/** @type {Map<string, Map<string, object>> | null} used when IndexedDB is unavailable */
let memory = null;

function memoryStore(name) {
  memory ??= new Map(Object.keys(FIELD_STORES).map((s) => [s, new Map()]));
  return memory.get(name);
}

/** @returns {Promise<IDBDatabase|null>} null when the queue has to live in memory */
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPath] of Object.entries(FIELD_STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab opening a newer version must not be blocked by this one.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

/** Oldest first: by `at`, then `seq` — the order the server replays in. */
export const byActOrder = (a, b) => {
  if (a.at !== b.at) return String(a.at) < String(b.at) ? -1 : 1;
  return (a.seq ?? 0) - (b.seq ?? 0);
};

function run(store, mode, fn) {
  return openDb().then((db) => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = fn(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

/** Every entry in a store, oldest first. */
export async function readAll(store) {
  const rows = await run(store, 'readonly', (s) => (s ? s.getAll() : null))
    ?? [...memoryStore(store).values()];
  return [...rows].sort(byActOrder);
}

export async function readOne(store, key) {
  const row = await run(store, 'readonly', (s) => (s ? s.get(key) : null));
  return row ?? memoryStore(store).get(key) ?? null;
}

export async function write(store, entry) {
  await run(store, 'readwrite', (s) => {
    if (s) return s.put(entry);
    memoryStore(store).set(entry[FIELD_STORES[store]], entry);
    return null;
  });
}

export async function remove(store, keys) {
  const list = [].concat(keys).filter(Boolean);
  if (!list.length) return;
  await run(store, 'readwrite', (s) => {
    list.forEach((k) => (s ? s.delete(k) : memoryStore(store).delete(k)));
    return null;
  });
}

export async function clearStore(store) {
  await run(store, 'readwrite', (s) => (s ? s.clear() : memoryStore(store).clear()));
}

let stampReady = null;
let lastSeq = 0;
let lastAt = 0;

/**
 * The next position in the act order: `seq` one past anything stored, and `at` (ISO) at least a
 * millisecond after the last one, whatever the clock says. The server sorts a replay by `at`, so two taps
 * inside one millisecond — or a clock set back — must not swap places.
 *
 * @param {number} [now]
 * @returns {Promise<{ seq: number, at: string }>}
 */
export async function nextStamp(now = Date.now()) {
  stampReady ??= (async () => {
    for (const store of Object.keys(FIELD_STORES)) {
      for (const row of await readAll(store)) {
        lastSeq = Math.max(lastSeq, Number(row.seq) || 0);
        lastAt = Math.max(lastAt, Date.parse(row.at) || 0);
      }
    }
  })();
  await stampReady;
  lastSeq += 1;
  lastAt = Math.max(now, lastAt + 1);
  return { seq: lastSeq, at: new Date(lastAt).toISOString() };
}

/** crypto.randomUUID is missing on plain-http origins in some browsers. */
export const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

/** Tests only: forget the in-memory queues and the stamp counters. */
export function resetFieldDbForTests() {
  memory = null;
  stampReady = null;
  lastSeq = 0;
  lastAt = 0;
}
