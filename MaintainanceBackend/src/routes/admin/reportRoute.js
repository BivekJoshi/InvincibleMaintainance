import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requires } from '../../middleware/authorize.js';
import { ok } from '../../utils/response.js';
import { reportQuery } from '../../shared/schemas/ops.js';
import { exportReportCsv } from '../../services/reportExport.service.js';

/**
 * `GET /admin/reports/<name>` — the report as JSON, or with `?format=csv` as a download of its main table
 * under the same filters (Phase I; `services/reportExport.service.js`):
 *
 *   router.get('/reports/aging', ...reportRoute('aging', 'reports:finance', () => reports.agingReport()));
 *
 * @param {string} name        the report's CSV name
 * @param {string} capability  who may read it
 * @param {(query: object) => Promise<unknown>} load  the JSON answer
 * @param {{ params?: import('zod').ZodTypeAny, scope?: (req: import('express').Request) => object }} [opts]
 *   `scope` adds to the query from the path (a statement's customerId)
 */
export const reportRoute = (name, capability, load, { params, scope } = {}) => [
  requires(capability),
  validate({ query: reportQuery, ...(params ? { params } : {}) }),
  asyncHandler(async (req, res) => {
    const query = { ...req.validatedQuery, ...(scope ? scope(req) : {}) };
    if (query.format !== 'csv') return ok(res, await load(query));
    const { filename, csv, truncated } = await exportReportCsv(name, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (truncated) res.setHeader('X-Export-Truncated', 'true');
    // The BOM makes Excel read Devanagari as UTF-8.
    return res.send(`\uFEFF${csv}`);
  }),
];
