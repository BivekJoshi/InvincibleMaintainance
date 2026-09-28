import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound } from '../utils/AppError.js';
import { lineAmount, outstanding, sum } from '../utils/money.js';
import { addDays, dayjs, kathmanduDayRange, local, startOfDay } from '../utils/dates.js';

/**
 * A report's period: `from`/`to` as Kathmandu days (inclusive), else the last 30 Kathmandu days, today
 * included (Phase I — the server's own timezone used to decide where a day began).
 */
const range = (q) => kathmanduDayRange(q.from, q.to) ?? { gte: startOfDay(addDays(new Date(), -29)) };

/** The period a report covered, as the Kathmandu days it names — for a CSV's filename. */
export function reportPeriod(q = {}) {
  const r = range(q);
  return { from: r.gte ? local(r.gte, 'YYYY-MM-DD') : null, to: r.lte ? local(r.lte, 'YYYY-MM-DD') : local(new Date(), 'YYYY-MM-DD') };
}

/** Where leads come from and which sources actually convert. */
export async function leadSourceReport(query = {}) {
  const createdAt = range(query);
  const rows = await prisma.lead.groupBy({
    by: ['source', 'status'],
    where: { deletedAt: null, createdAt },
    _count: { _all: true },
    _sum: { estimatedAmount: true },
  });
  const bySource = {};
  for (const r of rows) {
    const s = (bySource[r.source] ??= { source: r.source, total: 0, won: 0, lost: 0, open: 0, estimatedValue: 0 });
    s.total += r._count._all;
    s.estimatedValue += r._sum.estimatedAmount ?? 0;
    if (r.status === 'WON') s.won += r._count._all;
    else if (r.status === 'LOST') s.lost += r._count._all;
    else s.open += r._count._all;
  }
  return Object.values(bySource)
    .map((s) => ({ ...s, conversionRate: s.total ? Number(((s.won / s.total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Why leads were lost, and where: LOST leads closed in the range (Kathmandu days, on closedAt; all of them
 * without one) by category × the stage they were lost at × service. Rows are most-lost first.
 */
export async function lostReport(query = {}) {
  const closedAt = kathmanduDayRange(query.from, query.to);
  const groups = await prisma.lead.groupBy({
    by: ['lostCategory', 'lostAtStage', 'serviceId'],
    where: { deletedAt: null, status: 'LOST', ...(closedAt ? { closedAt } : {}) },
    _count: { _all: true },
  });
  const serviceIds = [...new Set(groups.map((g) => g.serviceId).filter(Boolean))];
  const services = new Map((await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }))
    .map((sv) => [sv.id, sv.name]));
  const rows = groups
    .map((g) => ({
      category: g.lostCategory, stage: g.lostAtStage, serviceId: g.serviceId,
      serviceName: g.serviceId ? services.get(g.serviceId) ?? null : null, count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  const byCategory = new Map();
  for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.count);
  return {
    total: sum(rows.map((r) => r.count)),
    byCategory: [...byCategory].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    rows,
  };
}

/** The funnel, stage by stage. */
export async function conversionFunnel(query = {}) {
  const createdAt = range(query);
  const rows = await prisma.lead.groupBy({
    by: ['status'], where: { deletedAt: null, createdAt }, _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const total = sum(Object.values(counts));
  const stages = [
    { key: 'NEW', label: 'Enquiries', count: total },
    { key: 'CONTACTED', label: 'Contacted', count: total - (counts.NEW ?? 0) },
    { key: 'QUOTED', label: 'Quoted', count: (counts.QUOTED ?? 0) + (counts.WON ?? 0) },
    { key: 'WON', label: 'Won', count: counts.WON ?? 0 },
  ];
  return {
    total,
    stages: stages.map((s) => ({ ...s, pct: total ? Number(((s.count / total) * 100).toFixed(1)) : 0 })),
    lost: counts.LOST ?? 0,
  };
}

/** Are we actually keeping the 2-hour promise? */
export async function slaComplianceReport(query = {}) {
  const createdAt = range(query);
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, createdAt, slaDueAt: { not: null } },
    select: { id: true, createdAt: true, slaDueAt: true, firstResponseAt: true, assignedToId: true, assignedTo: { select: { name: true } } },
  });

  const responded = leads.filter((l) => l.firstResponseAt);
  const onTime = responded.filter((l) => l.firstResponseAt <= l.slaDueAt);
  const responseMinutes = responded.map((l) => (new Date(l.firstResponseAt) - new Date(l.createdAt)) / 60000);
  responseMinutes.sort((a, b) => a - b);

  const byStaff = {};
  for (const l of leads) {
    const key = l.assignedTo?.name ?? 'Unassigned';
    const s = (byStaff[key] ??= { staff: key, total: 0, responded: 0, onTime: 0 });
    s.total += 1;
    if (l.firstResponseAt) {
      s.responded += 1;
      if (l.firstResponseAt <= l.slaDueAt) s.onTime += 1;
    }
  }

  return {
    total: leads.length,
    responded: responded.length,
    neverResponded: leads.length - responded.length,
    onTime: onTime.length,
    complianceRate: leads.length ? Number(((onTime.length / leads.length) * 100).toFixed(1)) : 0,
    avgResponseMinutes: responseMinutes.length ? Math.round(sum(responseMinutes) / responseMinutes.length) : null,
    medianResponseMinutes: responseMinutes.length ? Math.round(responseMinutes[Math.floor(responseMinutes.length / 2)]) : null,
    byStaff: Object.values(byStaff).map((s) => ({
      ...s, complianceRate: s.total ? Number(((s.onTime / s.total) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.total - a.total),
  };
}

const JOB_FOR_REVENUE = {
  select: {
    type: true,
    lead: { select: { service: { select: { name: true } } } },
    quotation: { select: { lead: { select: { service: { select: { name: true } } } } } },
    assignments: { where: { isLead: true }, select: { technician: { select: { id: true, user: { select: { name: true } } } } } },
  },
};

/** Which bucket an invoice falls in: its month or day (Kathmandu), its job's service, or its lead technician. */
function revenueKey(inv, groupBy) {
  if (groupBy === 'month') return { key: local(inv.issuedAt, 'YYYY-MM'), label: local(inv.issuedAt, 'MMM YYYY') };
  if (groupBy === 'day') return { key: local(inv.issuedAt, 'YYYY-MM-DD'), label: local(inv.issuedAt, 'D MMM YYYY') };
  const job = inv.items.find((i) => i.job)?.job;
  if (groupBy === 'technician') {
    const tech = job?.assignments?.[0]?.technician;
    return tech ? { key: tech.id, label: tech.user.name } : { key: 'none', label: 'No technician' };
  }
  const service = job?.lead?.service?.name ?? job?.quotation?.lead?.service?.name;
  if (service) return { key: service, label: service };
  return job ? { key: `type:${job.type}`, label: job.type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) }
    : { key: 'none', label: 'No job' };
}

/**
 * Revenue in the period (invoices by issue date, VOID and DRAFT left out — a draft is not revenue yet), by
 * month, day, service or technician. Each row: taxable (subtotal − discount), VAT, invoiced (total),
 * collected and outstanding — the stored document figures, summed, so the VAT reconciles to the paisa.
 */
export async function revenueReport(query = {}) {
  const issuedAt = range(query);
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { notIn: ['VOID', 'DRAFT'] }, issuedAt },
    include: { items: { select: { job: JOB_FOR_REVENUE } } },
  });

  const groupBy = query.groupBy ?? 'month';
  const buckets = new Map();
  for (const inv of invoices) {
    const { key, label } = revenueKey(inv, groupBy);
    if (!buckets.has(key)) buckets.set(key, { key, label, count: 0, taxable: 0, vat: 0, invoiced: 0, collected: 0, outstanding: 0 });
    const b = buckets.get(key);
    b.count += 1;
    b.taxable += inv.subtotal - inv.discount;
    b.vat += inv.vatAmount;
    b.invoiced += inv.total;
    b.collected += inv.paidAmount;
    b.outstanding += outstanding(inv.total, inv.paidAmount);
  }
  const rows = [...buckets.values()].sort((a, b) => (['month', 'day'].includes(groupBy)
    ? String(a.key).localeCompare(String(b.key)) : b.invoiced - a.invoiced));
  const total = (k) => sum(rows.map((r) => r[k]));
  return {
    groupBy,
    rows,
    totals: {
      count: total('count'), taxable: total('taxable'), vat: total('vat'),
      invoiced: total('invoiced'), collected: total('collected'), outstanding: total('outstanding'),
    },
  };
}

const AGING_LABELS = { current: 'Not yet due', d0_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90_plus: 'Over 90 days' };

/** Whole Kathmandu calendar days from `due` to `now`: due today is 0, due yesterday 1. */
const daysPast = (due, now) => {
  const tz = env.business.timezone;
  return dayjs(now).tz(tz).startOf('day').diff(dayjs(due).tz(tz).startOf('day'), 'day');
};

/**
 * Receivables as of now, in the usual buckets by days past due (Kathmandu calendar days): not yet due,
 * 1–30, 31–60, 61–90, over 90. Every sent invoice with money still owed; the period filter does not apply.
 * `invoices` is the drill-down, most overdue first.
 */
export async function agingReport(now = new Date()) {
  const rows = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  const buckets = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  const byCustomer = {};
  const invoices = [];

  for (const inv of rows) {
    const owed = outstanding(inv.total, inv.paidAmount);
    if (owed <= 0) continue;
    const daysOverdue = inv.dueDate ? daysPast(inv.dueDate, now) : 0;
    let bucket;
    if (daysOverdue <= 0) bucket = 'current';
    else if (daysOverdue <= 30) bucket = 'd0_30';
    else if (daysOverdue <= 60) bucket = 'd31_60';
    else if (daysOverdue <= 90) bucket = 'd61_90';
    else bucket = 'd90_plus';
    buckets[bucket] += owed;

    const row = {
      id: inv.id, number: inv.number, customer: { id: inv.customer.id, name: inv.customer.name },
      issuedAt: inv.issuedAt, dueDate: inv.dueDate, total: inv.total, paid: inv.paidAmount, outstanding: owed,
      daysOverdue: Math.max(0, daysOverdue), bucket, bucketLabel: AGING_LABELS[bucket],
    };
    invoices.push(row);
    const c = (byCustomer[inv.customerId] ??= {
      customer: inv.customer, total: 0, current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, invoices: [],
    });
    c.total += owed;
    c[bucket] += owed;
    c.invoices.push({ id: inv.id, number: inv.number, dueDate: inv.dueDate, outstanding: owed, daysOverdue: row.daysOverdue });
  }

  return {
    asOf: now,
    buckets,
    labels: AGING_LABELS,
    total: sum(Object.values(buckets)),
    byCustomer: Object.values(byCustomer).sort((a, b) => b.total - a.total),
    invoices: invoices.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding),
  };
}

/**
 * Money received in the period, by method. The totals cover every payment; the list is the newest `limit`
 * (500 on screen; a CSV asks for its cap) and says when it was cut. A voided payment was never received.
 */
export async function collectionsReport(query = {}, { limit = 500 } = {}) {
  const where = { receivedAt: range(query), voidedAt: null };
  const [groups, payments] = await Promise.all([
    prisma.payment.groupBy({ by: ['method'], where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.findMany({
      where,
      include: { invoice: { select: { id: true, number: true, customer: { select: { id: true, name: true } } } } },
      orderBy: { receivedAt: 'desc' },
      take: limit + 1,
    }),
  ]);
  const count = sum(groups.map((g) => g._count._all));
  return {
    total: sum(groups.map((g) => g._sum.amount)),
    count,
    byMethod: Object.fromEntries(groups.map((g) => [g.method, g._sum.amount ?? 0])),
    payments: payments.slice(0, limit),
    truncated: payments.length > limit,
  };
}

/** Which work actually makes money. */
export async function jobMarginReport(query = {}) {
  const createdAt = range(query);
  const jobs = await prisma.job.findMany({
    where: { deletedAt: null, status: { in: ['COMPLETED', 'VERIFIED'] }, createdAt },
    include: {
      materials: { include: { material: { select: { purchaseRate: true } } } },
      timeLogs: { include: { technician: { select: { hourlyRate: true } } } },
      expenses: true,
      invoiceItems: true,
    },
  });

  const rows = jobs.map((j) => {
    const materialCost = sum(j.materials.map((m) => lineAmount(m.qty, m.material.purchaseRate || m.rate)));
    const labourCost = sum(j.timeLogs.map((t) => lineAmount((t.minutes ?? 0) / 60, t.technician.hourlyRate ?? 0)));
    const expenseCost = sum(j.expenses.map((e) => e.amount));
    const invoiced = sum(j.invoiceItems.map((i) => i.amount));
    const cost = materialCost + labourCost + expenseCost;
    return {
      jobId: j.id, number: j.number, title: j.title, type: j.type,
      invoiced, cost, materialCost, labourCost, expenseCost,
      margin: invoiced - cost,
      marginPct: invoiced ? Number((((invoiced - cost) / invoiced) * 100).toFixed(1)) : null,
    };
  });

  const byType = {};
  for (const r of rows) {
    const t = (byType[r.type] ??= { type: r.type, count: 0, invoiced: 0, cost: 0 });
    t.count += 1;
    t.invoiced += r.invoiced;
    t.cost += r.cost;
  }

  return {
    rows: rows.sort((a, b) => b.margin - a.margin),
    byType: Object.values(byType).map((t) => ({
      ...t, margin: t.invoiced - t.cost,
      marginPct: t.invoiced ? Number((((t.invoiced - t.cost) / t.invoiced) * 100).toFixed(1)) : null,
    })),
    totals: { invoiced: sum(rows.map((r) => r.invoiced)), cost: sum(rows.map((r) => r.cost)), margin: sum(rows.map((r) => r.margin)) },
  };
}

export async function technicianProductivity(query = {}) {
  const createdAt = range(query);
  const techs = await prisma.technician.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { name: true } },
      assignments: { where: { job: { createdAt, deletedAt: null } }, include: { job: { select: { status: true, customerRating: true } } } },
      timeLogs: { where: { startedAt: createdAt } },
    },
  });
  return techs.map((t) => {
    const jobs = t.assignments.map((a) => a.job);
    const completed = jobs.filter((j) => ['COMPLETED', 'VERIFIED'].includes(j.status));
    const ratings = completed.map((j) => j.customerRating).filter(Boolean);
    return {
      technicianId: t.id,
      name: t.user.name,
      assigned: jobs.length,
      completed: completed.length,
      completionRate: jobs.length ? Number(((completed.length / jobs.length) * 100).toFixed(1)) : 0,
      minutesLogged: sum(t.timeLogs.map((l) => l.minutes ?? 0)),
      avgRating: ratings.length ? Number((sum(ratings) / ratings.length).toFixed(2)) : null,
      lifetimeRating: t.rating || null,
    };
  }).sort((a, b) => b.completed - a.completed);
}

const WARRANTY_JOB = {
  select: {
    type: true,
    lead: { select: { service: { select: { name: true } } } },
    quotation: { select: { lead: { select: { service: { select: { name: true } } } } } },
  },
};
/** The service a warranted job did — its lead's, else its quotation's lead's — or null. */
const serviceOf = (job) => job?.lead?.service?.name ?? job?.quotation?.lead?.service?.name ?? null;
const rate = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(1)) : 0);

/**
 * Warranty claim rate is the honest quality metric: warranties issued in the period and the claims raised in
 * it, by job type and (Phase I) by service — the claims queue shows a job's service's rate.
 */
export async function warrantyClaimReport(query = {}) {
  const createdAt = range(query);
  const [warranties, claims] = await Promise.all([
    prisma.warranty.findMany({ where: { createdAt }, include: { job: WARRANTY_JOB } }),
    prisma.warrantyClaim.findMany({ where: { createdAt }, include: { warranty: { include: { job: WARRANTY_JOB } } } }),
  ]);
  const tally = (keyOf, name) => {
    const out = new Map();
    const at = (key) => {
      if (!out.has(key)) out.set(key, { [name]: key, warranties: 0, claims: 0 });
      return out.get(key);
    };
    for (const w of warranties) at(keyOf(w.job)).warranties += 1;
    for (const c of claims) at(keyOf(c.warranty.job)).claims += 1;
    return [...out.values()].map((t) => ({ ...t, claimRate: rate(t.claims, t.warranties) })).sort((a, b) => b.warranties - a.warranties);
  };
  return {
    totalWarranties: warranties.length,
    totalClaims: claims.length,
    claimRate: rate(claims.length, warranties.length),
    byType: tally((job) => job.type, 'type'),
    byService: tally((job) => serviceOf(job) ?? 'Other', 'service'),
  };
}

/**
 * A customer's account: every sent invoice (a debit) and every payment standing (a credit), oldest first, with
 * the running balance. A DRAFT is not yet owed; a VOID never was; a voided payment was never received.
 */
export async function customerStatement(customerId) {
  const [customer, invoices, payments] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { id: true, name: true, phone: true, email: true, panVatNo: true } }),
    prisma.invoice.findMany({ where: { customerId, deletedAt: null, status: { notIn: ['VOID', 'DRAFT'] } }, orderBy: { issuedAt: 'asc' } }),
    prisma.payment.findMany({ where: { invoice: { customerId }, voidedAt: null }, orderBy: { receivedAt: 'asc' }, include: { invoice: { select: { number: true } } } }),
  ]);
  if (!customer) throw notFound('Customer');
  const entries = [
    ...invoices.map((i) => ({ at: i.issuedAt, kind: 'invoice', ref: i.number, invoiceId: i.id, debit: i.total, credit: 0 })),
    ...payments.map((p) => ({ at: p.receivedAt, kind: 'payment', ref: p.invoice.number, invoiceId: p.invoiceId, method: p.method, debit: 0, credit: p.amount })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  let balance = 0;
  const ledger = entries.map((e) => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });
  return {
    customer,
    ledger,
    totals: { invoiced: sum(invoices.map((i) => i.total)), paid: sum(payments.map((p) => p.amount)), outstanding: balance },
  };
}
