import { AsyncResource } from 'node:async_hooks';
import { runWithContext } from '../lib/requestContext.js';

/**
 * Opens the request context. Placed right after pino-http, which has already
 * assigned `req.id`. Every request starts as a public actor; authenticate turns
 * it into a user.
 *
 * Body parsers and multer receive the body through stream events, which Node
 * fires outside any AsyncLocalStorage run — so without the binds below, every
 * handler after express.json() would run with no context at all. Binding emit
 * runs each listener inside this request's context.
 */
export function requestContext(req, res, next) {
  const context = {
    requestId: req.id,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    actorType: 'public',
  };
  runWithContext(context, () => {
    req.emit = AsyncResource.bind(req.emit.bind(req));
    res.emit = AsyncResource.bind(res.emit.bind(res));
    next();
  });
}
