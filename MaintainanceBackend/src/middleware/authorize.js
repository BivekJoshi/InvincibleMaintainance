import { forbidden, unauthorized } from '../utils/AppError.js';
import { can } from '../shared/permissions.js';

/** Role gate: authorize('ADMIN', 'SALES') */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (roles.length && !roles.includes(req.user.role)) {
    return next(forbidden(`This action requires one of: ${roles.join(', ')}`));
  }
  next();
};

/** Capability gate: requires('leads:write') */
export const requires = (capability) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!can(req.user.role, capability)) {
    return next(forbidden(`Missing permission: ${capability}`));
  }
  next();
};
