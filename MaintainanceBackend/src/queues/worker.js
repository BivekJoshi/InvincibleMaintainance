/** Standalone worker process: `npm run worker`. */
import '../config/env.js';
import './handlers.js';
import { startWorker } from './index.js';
import { startCrons } from '../crons/index.js';
import { logger } from '../lib/logger.js';
import { disconnectPrisma } from '../lib/prisma.js';

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
