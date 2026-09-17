import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/sentry.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

// Express recognises an error handler by its four parameters, so _next stays.
export function errorHandler(err, req, res, _next) {
  // req.log carries the request id, so the error line joins its request line.
  const log = req.log ?? logger;
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;
  let logged = false;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE';
      const fields = err.meta?.target;
      message = `A record with this ${Array.isArray(fields) ? fields.join(' + ') : 'value'} already exists`;
      details = fields;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found';
    } else if (err.code === 'P2003') {
      status = 409;
      code = 'FK_CONSTRAINT';
      message = 'This record is referenced by other records and cannot be changed';
    } else {
      status = 400;
      code = `PRISMA_${err.code}`;
      message = 'Database request failed';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    code = 'PRISMA_VALIDATION';
    message = 'Malformed database query';
    // Usually a query the code built wrong, since bodies and query strings are
    // zod-validated first. It stays a 400 because a few list parameters (?sort,
    // some ?status filters) still reach Prisma unchecked, but it is logged at
    // warn: at debug level two real bugs of this kind went unnoticed for weeks.
    log.warn({ code, status, prisma: err.message.trim().split('\n').pop() }, 'prisma rejected a query');
    logged = true;
  }

  if (status >= 500) {
    log.error({ err, code, status }, 'unhandled error');
    captureException(err, { requestId: req.id, userId: req.user?.id, method: req.method });
    // The stack and the real message stay in the log; the client gets nothing internal.
    if (env.nodeEnv !== 'development') {
      code = 'INTERNAL_ERROR';
      message = 'Something went wrong';
      details = undefined;
    }
  } else if (!logged) {
    log.info({ code, status }, 'request rejected');
  }

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
