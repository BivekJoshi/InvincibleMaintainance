import { enqueue } from '../queues/index.js';
import { logger } from '../lib/logger.js';

const MINUTE = 60_000;

/**
 * Lightweight interval scheduler. Deliberately not a cron library: this system
 * has six recurring tasks and setInterval expresses them clearly.
 * Runs only in the process that owns background work.
 */
const SCHEDULE = [
  { name: 'sla:sweep', everyMs: 5 * MINUTE, immediate: true },
  { name: 'invoice:sweepOverdue', everyMs: 60 * MINUTE },
  { name: 'warranty:sweepExpired', everyMs: 6 * 60 * MINUTE },
  { name: 'amc:sweepContracts', everyMs: 12 * 60 * MINUTE },
  { name: 'amc:materialiseVisits', everyMs: 6 * 60 * MINUTE },
  { name: 'reminders:dispatch', everyMs: 30 * MINUTE },
];

const timers = [];

export function startCrons() {
  for (const task of SCHEDULE) {
    if (task.immediate) enqueue(task.name).catch(() => {});
    const t = setInterval(() => {
      enqueue(task.name).catch((err) => logger.error({ err: err.message, task: task.name }, 'cron enqueue failed'));
    }, task.everyMs);
    t.unref?.();
    timers.push(t);
  }
  logger.info({ tasks: SCHEDULE.map((s) => s.name) }, 'schedulers started');
}

export function stopCrons() {
  timers.forEach(clearInterval);
  timers.length = 0;
}
