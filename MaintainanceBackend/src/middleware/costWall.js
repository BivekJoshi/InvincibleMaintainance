import { stripCosts } from '../utils/moneyWall.js';

/**
 * The staff cost wall on a group of routes (L-D4): every JSON response's `data` goes through
 * `stripCosts` for the caller's role — a no-op for costs:read. Mounted by path (`router.use('/quotations',
 * costWall)`), never router-wide: several routers share `/admin`, and a router-wide wrapper would reach
 * requests that only pass through (a dispatcher's materials, whose purchase rate is theirs to see).
 */
export function costWall(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => json(body?.data === undefined ? body : { ...body, data: stripCosts(body.data, { role: req.user?.role }) });
  next();
}
