import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import path from 'node:path';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { prisma } from './lib/prisma.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
    autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  }));

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded images are served to the SPAs
    contentSecurityPolicy: env.isProd ? undefined : false,
  }));

  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
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
