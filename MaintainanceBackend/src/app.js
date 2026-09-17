import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import path from 'node:path';
import { env } from './config/env.js';
import { logger as defaultLogger, serializers } from './lib/logger.js';
import { isValidRequestId } from './lib/requestContext.js';
import { requestContext } from './middleware/requestContext.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { AppError } from './utils/AppError.js';
import { prisma } from './lib/prisma.js';
import routes from './routes/index.js';

/**
 * @param {object} [opts]
 * @param {import('pino').Logger} [opts.logger]  tests pass a logger writing to a captured stream
 */
export function createApp({ logger = defaultLogger } = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({
    logger,
    serializers,
    // A client may pass its own id to correlate a request across systems, but only
    // a plain token: anything else is replaced, so it cannot forge log lines.
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = isValidRequestId(incoming) ? incoming : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'info'),
  }));
  app.use(requestContext);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded images are served to the SPAs
    contentSecurityPolicy: env.isProd ? undefined : false,
  }));

  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new AppError(403, 'FORBIDDEN_ORIGIN', 'This origin is not allowed to call the API'));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  }));

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(globalLimiter);

  // Uploaded media (local storage driver).
  app.use(
    env.storage.publicPath,
    express.static(path.resolve(process.cwd(), env.storage.uploadDir), {
      maxAge: env.isProd ? '30d' : 0,
      immutable: env.isProd,
      fallthrough: false,
    }),
  );

  app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', database: 'up' });
    } catch (err) {
      res.status(503).json({ status: 'not-ready', database: 'down', error: err.message });
    }
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
