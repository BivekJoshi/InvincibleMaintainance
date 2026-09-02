export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code machine-readable code, e.g. NOT_FOUND
   * @param {string} message human-readable message
   * @param {unknown} [details] optional field-level detail
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const notFound = (what = 'Record') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const badRequest = (msg, details) => new AppError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You do not have access to this resource') => new AppError(403, 'FORBIDDEN', msg);
export const conflict = (msg, details) => new AppError(409, 'CONFLICT', msg, details);
export const unprocessable = (msg, details) => new AppError(422, 'UNPROCESSABLE', msg, details);
export const tooMany = (msg = 'Too many requests') => new AppError(429, 'RATE_LIMITED', msg);
