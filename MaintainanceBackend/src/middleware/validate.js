import { ZodError } from 'zod';
import { badRequest } from '../utils/AppError.js';

/**
 * Validates and REPLACES req.body / req.query / req.params with the parsed result,
 * so controllers only ever see coerced, trusted data.
 * @param {{body?:import('zod').ZodTypeAny, query?:import('zod').ZodTypeAny, params?:import('zod').ZodTypeAny}} shape
 */
export const validate = (shape) => (req, _res, next) => {
  try {
    if (shape.body) req.body = shape.body.parse(req.body ?? {});
    if (shape.query) req.validatedQuery = shape.query.parse(req.query ?? {});
    if (shape.params) req.params = shape.params.parse(req.params ?? {});
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest('Validation failed', details));
    }
    next(err);
  }
};
