import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

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
  }

  if (status >= 500) {
    logger.error({ err, url: req.originalUrl, method: req.method, userId: req.user?.id }, 'unhandled error');
    if (env.isProd) {
      message = 'Something went wrong';
      details = undefined;
    }
  } else {
    logger.debug({ code, message, url: req.originalUrl }, 'request rejected');
  }

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
