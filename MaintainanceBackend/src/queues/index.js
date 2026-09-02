import { Queue, Worker } from 'bullmq';
import { getRedis, hasRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'maintenance';
const handlers = new Map();

let queue = null;

/** Registers a named job handler. */
export function registerHandler(name, fn) {
  handlers.set(name, fn);
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
  const run = async () => {
    const fn = handlers.get(name);
    if (!fn) return logger.warn({ name }, 'no handler registered for job');
    try {
      await fn(data);
    } catch (err) {
      logger.error({ err: err.message, name }, 'in-process job failed');
    }
  };
  if (opts.delay) setTimeout(run, opts.delay).unref?.();
  else setImmediate(run);
  return { id: `inproc-${Date.now()}` };
}

/** Starts the BullMQ consumer. No-op without Redis (handlers run in-process). */
export function startWorker() {
  if (!hasRedis()) {
    logger.info('REDIS_URL is not set — background jobs run in-process');
    return null;
  }
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const fn = handlers.get(job.name);
      if (!fn) throw new Error(`No handler registered for job "${job.name}"`);
      return fn(job.data);
    },
    { connection: getRedis(), concurrency: 5 },
  );
  worker.on('failed', (job, err) => logger.error({ job: job?.name, err: err.message }, 'queue job failed'));
  worker.on('completed', (job) => logger.debug({ job: job.name }, 'queue job done'));
  logger.info('BullMQ worker started');
  return worker;
}
