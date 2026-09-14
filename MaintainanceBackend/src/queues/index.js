import { Queue, Worker } from 'bullmq';
import { getRedis, hasRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { runWithContext } from '../lib/requestContext.js';
import { captureException } from '../lib/sentry.js';

const QUEUE_NAME = 'maintenance';
const handlers = new Map();

let queue = null;
let inprocSeq = 0;

/** Registers a named job handler. */
export function registerHandler(name, fn) {
  handlers.set(name, fn);
}

/** The number a task reports, whatever it calls it: { expired: 3 } → 3. */
function countOf(result) {
  if (typeof result === 'number') return result;
  if (result && typeof result === 'object') return Object.values(result).find((v) => typeof v === 'number');
  return undefined;
}

/**
 * Runs one job as the system actor. Its request id is `<task>:<job id>`, so its
 * log lines and audit rows can be found together. Both the BullMQ worker and the
 * in-process fallback come through here.
 *
 * @param {string} name
 * @param {object} [data]
 * @param {string|number} [jobId]
 */
export function runJob(name, data = {}, jobId = `inproc-${Date.now()}-${(inprocSeq += 1)}`) {
  const requestId = `${name}:${jobId}`;
  return runWithContext({ requestId, actorType: 'system' }, async () => {
    const started = Date.now();
    try {
      const fn = handlers.get(name);
      if (!fn) throw new Error(`No handler registered for job "${name}"`);
      const result = await fn(data);
      logger.info({ task: name, jobId, durationMs: Date.now() - started, count: countOf(result) }, 'task finished');
      return result;
    } catch (err) {
      logger.error({ task: name, jobId, durationMs: Date.now() - started, err }, 'task failed');
      captureException(err, { requestId, task: name, jobId });
      throw err;
    }
  });
}

/**
 * Enqueues work. Uses BullMQ when Redis is configured; otherwise falls back to
 * an in-process timer so development needs no extra service.
 */
export async function enqueue(name, data = {}, opts = {}) {
  if (hasRedis()) {
    queue ??= new Queue(QUEUE_NAME, { connection: getRedis() });
    return queue.add(name, data, { removeOnComplete: 200, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, ...opts });
  }
  const id = `inproc-${Date.now()}-${(inprocSeq += 1)}`;
  const run = () => runJob(name, data, id).catch(() => {}); // runJob has logged it
  if (opts.delay) setTimeout(run, opts.delay).unref?.();
  else setImmediate(run);
  return { id };
}

/** Starts the BullMQ consumer. No-op without Redis (handlers run in-process). */
export function startWorker() {
  if (!hasRedis()) {
    logger.info('REDIS_URL is not set — background jobs run in-process');
    return null;
  }
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => runJob(job.name, job.data, job.id),
    { connection: getRedis(), concurrency: 5 },
  );
  logger.info('BullMQ worker started');
  return worker;
}
