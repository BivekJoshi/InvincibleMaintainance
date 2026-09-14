import { prisma } from '../lib/prisma.js';
import { dateRange } from '../utils/pagination.js';
import { sum } from '../utils/money.js';
import { addDays, startOfDay, endOfDay } from '../utils/dates.js';
import { slaWhere } from './sla.service.js';

const range = (q) => dateRange(q.from, q.to) ?? { gte: addDays(new Date(), -30) };

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

export async function revenueReport(query = {}) {
  const issuedAt = range(query);
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { not: 'VOID' }, issuedAt },
    include: { items: { include: { job: { select: { type: true } } } } },
  });

  const groupBy = query.groupBy ?? 'month';
  const buckets = {};
  for (const inv of invoices) {
    let key;
    if (groupBy === 'month') key = inv.issuedAt.toISOString().slice(0, 7);
    else if (groupBy === 'service') key = inv.items[0]?.job?.type ?? 'Other';
    else key = inv.issuedAt.toISOString().slice(0, 10);
    const b = (buckets[key] ??= { key, invoiced: 0, collected: 0, outstanding: 0, count: 0 });
    b.invoiced += inv.total;
    b.collected += inv.paidAmount;
    b.outstanding += inv.total - inv.paidAmount;
    b.count += 1;
  }
  const rows = Object.values(buckets).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return {
    groupBy,
    rows,
    totals: {
      invoiced: sum(rows.map((r) => r.invoiced)),
      collected: sum(rows.map((r) => r.collected)),
      outstanding: sum(rows.map((r) => r.outstanding)),
      count: sum(rows.map((r) => r.count)),
    },
  };
}

/** Receivables split into the usual aging buckets. */
export async function agingReport() {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  const now = Date.now();
  const buckets = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  const byCustomer = {};

  for (const inv of invoices) {
    const outstanding = inv.total - inv.paidAmount;
    if (outstanding <= 0) continue;
    const daysOverdue = inv.dueDate ? Math.floor((now - new Date(inv.dueDate)) / 86400000) : 0;
    let bucket;
    if (daysOverdue <= 0) bucket = 'current';
    else if (daysOverdue <= 30) bucket = 'd0_30';
    else if (daysOverdue <= 60) bucket = 'd31_60';
    else if (daysOverdue <= 90) bucket = 'd61_90';
    else bucket = 'd90_plus';
    buckets[bucket] += outstanding;

    const c = (byCustomer[inv.customerId] ??= {
      customer: inv.customer, total: 0, current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, invoices: [],
    });
    c.total += outstanding;
    c[bucket] += outstanding;
    c.invoices.push({ id: inv.id, number: inv.number, dueDate: inv.dueDate, outstanding, daysOverdue });
  }

  return {
    buckets,
    total: sum(Object.values(buckets)),
    byCustomer: Object.values(byCustomer).sort((a, b) => b.total - a.total),
  };
}

export async function collectionsReport(query = {}) {
  const receivedAt = range(query);
  const payments = await prisma.payment.findMany({
    // A voided payment was never money received.
    where: { receivedAt, voidedAt: null },
    include: { invoice: { select: { number: true, customer: { select: { name: true } } } } },
    orderBy: { receivedAt: 'desc' },
  });
  const byMethod = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  }
  return { total: sum(payments.map((p) => p.amount)), count: payments.length, byMethod, payments };
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
    const materialCost = sum(j.materials.map((m) => Math.round(m.qty * (m.material.purchaseRate || m.rate))));
    const labourCost = sum(j.timeLogs.map((t) => Math.round(((t.minutes ?? 0) / 60) * (t.technician.hourlyRate ?? 0))));
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

/** Warranty claim rate is the honest quality metric. */
export async function warrantyClaimReport(query = {}) {
  const createdAt = range(query);
  const [warranties, claims] = await Promise.all([
    prisma.warranty.findMany({ where: { createdAt }, include: { job: { select: { type: true } } } }),
    prisma.warrantyClaim.findMany({ where: { createdAt }, include: { warranty: { include: { job: { select: { type: true } } } } } }),
  ]);
  const byType = {};
  for (const w of warranties) {
    const t = (byType[w.job.type] ??= { type: w.job.type, warranties: 0, claims: 0 });
    t.warranties += 1;
  }
  for (const c of claims) {
    const t = (byType[c.warranty.job.type] ??= { type: c.warranty.job.type, warranties: 0, claims: 0 });
    t.claims += 1;
  }
  return {
    totalWarranties: warranties.length,
    totalClaims: claims.length,
    claimRate: warranties.length ? Number(((claims.length / warranties.length) * 100).toFixed(1)) : 0,
    byType: Object.values(byType).map((t) => ({
      ...t, claimRate: t.warranties ? Number(((t.claims / t.warranties) * 100).toFixed(1)) : 0,
    })),
  };
}

export async function customerStatement(customerId) {
  const [customer, invoices, payments] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.invoice.findMany({ where: { customerId, deletedAt: null, status: { not: 'VOID' } }, orderBy: { issuedAt: 'asc' } }),
    prisma.payment.findMany({ where: { invoice: { customerId }, voidedAt: null }, orderBy: { receivedAt: 'asc' }, include: { invoice: { select: { number: true } } } }),
  ]);
  const entries = [
    ...invoices.map((i) => ({ at: i.issuedAt, kind: 'invoice', ref: i.number, debit: i.total, credit: 0 })),
    ...payments.map((p) => ({ at: p.receivedAt, kind: 'payment', ref: p.invoice.number, debit: 0, credit: p.amount })),
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

/** Role-aware dashboard payload — one call per login instead of a dozen. */
export async function dashboard(role) {
  const today = { gte: startOfDay(), lte: endOfDay() };
  const last30 = { gte: addDays(new Date(), -30) };

  const [
    leadsToday, leadsOpen, slaBreached, slaAtRisk,
    jobsToday, jobsOpen, jobsUnassigned,
    invoicesOutstanding, warrantiesActive, amcRenewals,
  ] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null, createdAt: today } }),
    prisma.lead.count({ where: { deletedAt: null, status: { notIn: ['WON', 'LOST'] } } }),
    prisma.lead.count({ where: { deletedAt: null, ...slaWhere('breached') } }),
    prisma.lead.count({ where: { deletedAt: null, ...slaWhere('at_risk') } }),
    prisma.job.count({ where: { deletedAt: null, scheduledStart: today } }),
    prisma.job.count({ where: { deletedAt: null, status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] } } }),
    prisma.job.count({ where: { deletedAt: null, assignments: { none: {} }, status: { in: ['DRAFT', 'SCHEDULED'] } } }),
    prisma.invoice.aggregate({
      where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, paidAmount: true }, _count: { _all: true },
    }),
    prisma.warranty.count({ where: { status: 'ACTIVE', endsAt: { gte: new Date() } } }),
    prisma.amcContract.count({ where: { deletedAt: null, status: 'active', endDate: { lte: addDays(new Date(), 60) } } }),
  ]);

  const outstanding = (invoicesOutstanding._sum.total ?? 0) - (invoicesOutstanding._sum.paidAmount ?? 0);

  const cards = {
    leadsToday, leadsOpen, slaBreached, slaAtRisk,
    jobsToday, jobsOpen, jobsUnassigned,
    outstandingAmount: outstanding, outstandingInvoices: invoicesOutstanding._count._all,
    warrantiesActive, amcRenewals,
  };

  const [funnel, sla, revenue] = await Promise.all([
    conversionFunnel({ from: last30.gte }),
    slaComplianceReport({ from: last30.gte }),
    revenueReport({ from: last30.gte, groupBy: 'day' }),
  ]);

  const VISIBLE = {
    ADMIN: Object.keys(cards),
    EDITOR: ['leadsToday'],
    SALES: ['leadsToday', 'leadsOpen', 'slaBreached', 'slaAtRisk', 'amcRenewals'],
    DISPATCHER: ['jobsToday', 'jobsOpen', 'jobsUnassigned'],
    TECHNICIAN: ['jobsToday'],
    ACCOUNTANT: ['outstandingAmount', 'outstandingInvoices'],
  };
  const allowed = VISIBLE[role] ?? [];

  return {
    role,
    cards: Object.fromEntries(Object.entries(cards).filter(([k]) => allowed.includes(k))),
    ...(role === 'ADMIN' || role === 'SALES' ? { funnel, sla } : {}),
    ...(role === 'ADMIN' || role === 'ACCOUNTANT' ? { revenue } : {}),
  };
}
