import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { disconnectPrisma } from './lib/prisma.js';
import { startWorker } from './queues/index.js';
import { startCrons, stopCrons } from './crons/index.js';
import './queues/handlers.js';
import { hasRedis } from './lib/redis.js';

const app = createApp();
const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, env: env.nodeEnv, redis: hasRedis(), storage: env.storage.driver },
    `${env.appName} API listening on http://localhost:${env.port}`,
  );
});

// Without Redis there is no separate worker process, so run background work here.
let worker = null;
if (process.env.RUN_WORKER_INLINE !== 'false') {
  worker = startWorker();
  startCrons();
}

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  stopCrons();
  await worker?.close();
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
