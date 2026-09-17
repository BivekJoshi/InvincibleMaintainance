/** Standalone worker process: `npm run worker`. */
import '../config/env.js';
import './handlers.js';
import { startWorker } from './index.js';
import { startCrons } from '../crons/index.js';
import { logger } from '../lib/logger.js';
import { initSentry, captureException, flushSentry } from '../lib/sentry.js';
import { disconnectPrisma } from '../lib/prisma.js';

await initSentry();

const worker = startWorker();
startCrons();
logger.info('worker process ready');

async function shutdown(signal) {
  logger.info({ signal }, 'worker shutting down');
  await worker?.close();
  await disconnectPrisma();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  captureException(reason);
});
process.on('uncaughtException', async (err) => {
  logger.fatal({ err }, 'uncaught exception');
  captureException(err);
  await flushSentry();
  process.exit(1);
});
