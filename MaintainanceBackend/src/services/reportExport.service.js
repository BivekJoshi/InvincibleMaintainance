import { AUDIT_EVENTS } from '../shared/enums.js';
import { CSV_MAX_ROWS, day, money, text, toCsv } from '../utils/csv.js';
import { local } from '../utils/dates.js';
import { recordEvent } from './audit.service.js';
import * as reports from './report.service.js';

/**
 * Every report as a CSV download (Phase I, `?format=csv`): the rows the screen shows under the same filters,
 * money as rupees, dates in Kathmandu, capped at `CSV_MAX_ROWS`, and audited as `export.csv`.
 *
 * Each entry names the report's main table: `load` runs the report (asking for the CSV cap where the report
 * pages its rows), `rows` picks the table out of its result.
 */
const pct = (header, value) => text(header, value);
const share = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(1)) : 0);

const REPORTS = {
  aging: {
    load: () => reports.agingReport(),
    rows: (d) => d.invoices,
    columns: [
      text('Invoice', (r) => r.number), text('Customer', (r) => r.customer.name), day('Issued', (r) => r.issuedAt),
      day('Due', (r) => r.dueDate), text('Days overdue', (r) => r.daysOverdue), text('Bucket', (r) => r.bucketLabel),
      money('Total (Rs)', (r) => r.total), money('Paid (Rs)', (r) => r.paid), money('Outstanding (Rs)', (r) => r.outstanding),
    ],
  },
  revenue: {
    load: (q) => reports.revenueReport(q),
    rows: (d) => d.rows,
    columns: [
      text('Group', (r) => r.label), text('Invoices', (r) => r.count), money('Taxable (Rs)', (r) => r.taxable),
      money('VAT (Rs)', (r) => r.vat), money('Invoiced (Rs)', (r) => r.invoiced), money('Collected (Rs)', (r) => r.collected),
      money('Outstanding (Rs)', (r) => r.outstanding),
    ],
  },
  collections: {
    load: (q) => reports.collectionsReport(q, { limit: CSV_MAX_ROWS }),
    rows: (d) => d.payments,
    columns: [
      text('Received', (r) => local(r.receivedAt, 'YYYY-MM-DD HH:mm')), text('Invoice', (r) => r.invoice.number),
      text('Customer', (r) => r.invoice.customer?.name), text('Method', (r) => r.method), text('Reference', (r) => r.reference),
      money('Amount (Rs)', (r) => r.amount),
    ],
  },
  'lead-sources': {
    load: (q) => reports.leadSourceReport(q),
    rows: (d) => d,
    columns: [
      text('Source', (r) => r.source), text('Leads', (r) => r.total), text('Won', (r) => r.won), text('Lost', (r) => r.lost),
      text('Open', (r) => r.open), pct('Conversion %', (r) => r.conversionRate), money('Estimated value (Rs)', (r) => r.estimatedValue),
    ],
  },
  funnel: {
    load: (q) => reports.conversionFunnel(q),
    rows: (d) => [...d.stages, { label: 'Lost', count: d.lost, pct: share(d.lost, d.total) }],
    columns: [text('Stage', (r) => r.label), text('Leads', (r) => r.count), pct('% of enquiries', (r) => r.pct)],
  },
  sla: {
    load: (q) => reports.slaComplianceReport(q),
    rows: (d) => d.byStaff,
    columns: [
      text('Staff', (r) => r.staff), text('Leads', (r) => r.total), text('Responded', (r) => r.responded),
      text('On time', (r) => r.onTime), pct('Compliance %', (r) => r.complianceRate),
    ],
  },
  lost: {
    load: (q) => reports.lostReport(q),
    rows: (d) => d.rows,
    columns: [
      text('Category', (r) => r.category), text('Lost at stage', (r) => r.stage), text('Service', (r) => r.serviceName),
      text('Leads', (r) => r.count),
    ],
  },
  'job-margin': {
    load: (q) => reports.jobMarginReport(q),
    rows: (d) => d.rows,
    columns: [
      text('Job', (r) => r.number), text('Title', (r) => r.title), text('Type', (r) => r.type),
      money('Invoiced (Rs)', (r) => r.invoiced), money('Materials (Rs)', (r) => r.materialCost), money('Labour (Rs)', (r) => r.labourCost),
      money('Expenses (Rs)', (r) => r.expenseCost), money('Cost (Rs)', (r) => r.cost), money('Margin (Rs)', (r) => r.margin),
      pct('Margin %', (r) => r.marginPct),
    ],
  },
  technicians: {
    load: (q) => reports.technicianProductivity(q),
    rows: (d) => d,
    columns: [
      text('Technician', (r) => r.name), text('Assigned', (r) => r.assigned), text('Completed', (r) => r.completed),
      pct('Completion %', (r) => r.completionRate), text('Hours logged', (r) => Number(((r.minutesLogged ?? 0) / 60).toFixed(1))),
      text('Average rating', (r) => r.avgRating),
    ],
  },
  'warranty-claims': {
    load: (q) => reports.warrantyClaimReport(q),
    rows: (d) => d.byService,
    columns: [
      text('Service', (r) => r.service), text('Warranties', (r) => r.warranties), text('Claims', (r) => r.claims),
      pct('Claim rate %', (r) => r.claimRate),
    ],
  },
  statement: {
    load: (q) => reports.customerStatement(q.customerId),
    rows: (d) => d.ledger,
    columns: [
      day('Date', (r) => r.at), text('Entry', (r) => (r.kind === 'invoice' ? 'Invoice' : `Payment (${r.method})`)), text('Invoice', (r) => r.ref),
      money('Debit (Rs)', (r) => r.debit), money('Credit (Rs)', (r) => r.credit), money('Balance (Rs)', (r) => r.balance),
    ],
  },
};

export const REPORT_NAMES = Object.freeze(Object.keys(REPORTS));

/**
 * One report as CSV, recorded as `export.csv` (model `Report`; a statement on its customer).
 * @param {string} name  a key of REPORTS
 * @param {object} query  the validated filters (from, to, groupBy; a statement's customerId)
 * @returns {Promise<{ filename: string, csv: string, rows: number, truncated: boolean }>}
 */
export async function exportReportCsv(name, query = {}) {
  const spec = REPORTS[name];
  if (!spec) throw new Error(`No CSV for the report "${name}"`);
  const data = await spec.load(query);
  const out = toCsv(spec.columns, spec.rows(data));
  const { format: _format, ...filters } = query;
  const asOf = name === 'aging' || name === 'statement';
  const { from, to } = asOf ? { from: null, to: local(new Date(), 'YYYY-MM-DD') } : reports.reportPeriod(query);
  await recordEvent(AUDIT_EVENTS.EXPORT_CSV, {
    model: name === 'statement' ? 'Customer' : 'Report',
    recordId: name === 'statement' ? query.customerId : null,
    meta: { report: name, ...filters, rows: out.rows, truncated: out.truncated },
  });
  const span = [from, to].filter(Boolean).join('-to-');
  return { filename: `${name}${query.groupBy ? `-by-${query.groupBy}` : ''}-${span}.csv`, ...out };
}
