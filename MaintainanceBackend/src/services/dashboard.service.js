import { prisma } from '../lib/prisma.js';
import { sum } from '../utils/money.js';
import { addDays, startOfDay, endOfDay, local } from '../utils/dates.js';
import { slaWhere } from './sla.service.js';
import { lowStockCount } from './material.service.js';
import { conversionFunnel, slaComplianceReport, revenueReport, leadSourceReport } from './report.service.js';

/** Kathmandu calendar days, oldest first: `from` days ago through `to` days ahead of today. */
function ktmDays(from, to) {
  const today = startOfDay();
  return Array.from({ length: from + to + 1 }, (_, i) => local(addDays(today, i - from + 0.5), 'YYYY-MM-DD'));
}

const today = () => ({ gte: startOfDay(), lte: endOfDay() });
const OPEN_LEAD = { notIn: ['WON', 'LOST'] };

/** Leads per Kathmandu day for the last `days` days, and how many of them are already won. */
export async function leadTrend(days = 14) {
  const keys = ktmDays(days - 1, 0);
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, createdAt: { gte: startOfDay(addDays(new Date(), -(days - 1))) } },
    select: { createdAt: true, status: true },
  });
  const byDay = Object.fromEntries(keys.map((day) => [day, { day, leads: 0, won: 0 }]));
  for (const l of leads) {
    const b = byDay[local(l.createdAt, 'YYYY-MM-DD')];
    if (!b) continue;
    b.leads += 1;
    if (l.status === 'WON') b.won += 1;
  }
  return keys.map((k) => byDay[k]);
}

/**
 * When enquiries arrive, over the last 30 days: a count per Kathmandu weekday
 * (0 = Sunday) and time band, so staffing can follow the phone.
 */
export const HEATMAP_BANDS = [
  { key: 'early', label: 'Before 8', from: 0, to: 8 },
  { key: 'h8', label: '8–10', from: 8, to: 10 },
  { key: 'h10', label: '10–12', from: 10, to: 12 },
  { key: 'h12', label: '12–2', from: 12, to: 14 },
  { key: 'h14', label: '2–4', from: 14, to: 16 },
  { key: 'h16', label: '4–6', from: 16, to: 18 },
  { key: 'late', label: 'After 6', from: 18, to: 24 },
];

export async function leadHeatmap(days = 30) {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, createdAt: { gte: startOfDay(addDays(new Date(), -(days - 1))) } },
    select: { createdAt: true },
  });
  const cells = Array.from({ length: 7 }, () => HEATMAP_BANDS.map(() => 0));
  for (const l of leads) {
    const [weekday, hour] = local(l.createdAt, 'd H').split(' ').map(Number);
    const band = HEATMAP_BANDS.findIndex((b) => hour >= b.from && hour < b.to);
    cells[weekday][band] += 1;
  }
  return { bands: HEATMAP_BANDS.map(({ key, label }) => ({ key, label })), cells, total: leads.length };
}

/** Jobs on the calendar for today and the six days after, per Kathmandu day. */
export async function jobsWeek() {
  const keys = ktmDays(0, 6);
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null, status: { not: 'CANCELLED' },
      scheduledStart: { gte: startOfDay(), lte: endOfDay(addDays(new Date(), 6)) },
    },
    select: { scheduledStart: true },
  });
  const counts = {};
  for (const j of jobs) {
    const day = local(j.scheduledStart, 'YYYY-MM-DD');
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return keys.map((day) => ({ day, jobs: counts[day] ?? 0 }));
}

/** Every open job, by where it is in its lifecycle. */
export async function openJobsByStatus() {
  const rows = await prisma.job.groupBy({
    by: ['status'],
    where: { deletedAt: null, status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

/** Today's run sheet: the first `limit` jobs by start time, with who is going. */
export async function todaysJobs(limit = 8) {
  const where = { deletedAt: null, status: { not: 'CANCELLED' }, scheduledStart: today() };
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { scheduledStart: 'asc' },
      take: limit,
      select: {
        id: true, number: true, title: true, status: true, priority: true, scheduledStart: true, scheduledEnd: true,
        customer: { select: { name: true } },
        site: { select: { area: true } },
        assignments: { select: { isLead: true, technician: { select: { user: { select: { name: true } } } } } },
      },
    }),
  ]);
  return {
    total,
    items: jobs.map(({ customer, site, assignments, ...j }) => ({
      ...j,
      customer: customer?.name ?? null,
      area: site?.area ?? null,
      technicians: [...assignments].sort((a, b) => Number(b.isLead) - Number(a.isLead)).map((a) => a.technician.user.name),
    })),
  };
}

/** Who is out today, against what they can take. */
export async function technicianLoad() {
  const techs = await prisma.technician.findMany({
    where: { deletedAt: null, user: { isActive: true } },
    select: {
      id: true, dailyCapacity: true, isAvailable: true,
      user: { select: { name: true } },
      assignments: {
        where: { job: { deletedAt: null, status: { not: 'CANCELLED' }, scheduledStart: today() } },
        select: { id: true },
      },
    },
  });
  return techs
    .map((t) => ({
      id: t.id, name: t.user.name, isAvailable: t.isAvailable,
      capacity: t.dailyCapacity, jobs: t.assignments.length,
    }))
    .sort((a, b) => b.jobs / (b.capacity || 1) - a.jobs / (a.capacity || 1) || a.name.localeCompare(b.name));
}

/** The leads nobody has called yet, the most urgent deadline first. */
export async function slaQueue(limit = 6) {
  const where = { deletedAt: null, firstResponseAt: null, slaDueAt: { not: null }, status: OPEN_LEAD };
  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { slaDueAt: 'asc' },
      take: limit,
      select: {
        id: true, name: true, area: true, priority: true, source: true, slaDueAt: true, createdAt: true,
        service: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);
  return {
    total,
    items: leads.map(({ service, assignedTo, ...l }) => ({
      ...l, service: service?.name ?? null, assignedTo: assignedTo?.name ?? null,
    })),
  };
}

const PIPELINE_STAGES = ['DRAFT', 'PENDING_APPROVAL', 'OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED'];

/** Quotations still in play, count and value per stage, and how the last 30 days' answers went. */
export async function quotationPipeline(days = 30) {
  const since = addDays(new Date(), -days);
  const [open, decided] = await Promise.all([
    prisma.quotation.groupBy({
      by: ['status'],
      where: { deletedAt: null, status: { in: PIPELINE_STAGES } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.quotation.groupBy({
      by: ['status'],
      where: { deletedAt: null, decidedAt: { gte: since }, status: { in: ['APPROVED', 'CONVERTED', 'REJECTED'] } },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);
  const byStatus = Object.fromEntries(open.map((r) => [r.status, r]));
  const stages = PIPELINE_STAGES.map((status) => ({
    status, count: byStatus[status]?._count._all ?? 0, value: byStatus[status]?._sum.total ?? 0,
  }));
  const wonRows = decided.filter((r) => r.status !== 'REJECTED');
  const won = sum(wonRows.map((r) => r._count._all));
  const lost = sum(decided.filter((r) => r.status === 'REJECTED').map((r) => r._count._all));
  return {
    stages,
    openValue: sum(stages.map((s) => s.value)),
    openCount: sum(stages.map((s) => s.count)),
    won, lost,
    wonValue: sum(wonRows.map((r) => r._sum.total ?? 0)),
    winRate: won + lost ? Number(((won / (won + lost)) * 100).toFixed(1)) : null,
  };
}

const SALES_CARDS = [
  'leadsToday', 'leadsOpen', 'slaBreached', 'slaAtRisk', 'amcRenewals',
  'quotationsPendingApproval', 'quotationsChangesRequested', 'quotationsAwaitingCustomer',
];
const VISIBLE_CARDS = {
  EDITOR: ['leadsToday'],
  SALES: SALES_CARDS,
  MANAGER: [...SALES_CARDS, 'acceptedJobsUnscheduled'],
  DISPATCHER: ['jobsToday', 'jobsOpen', 'jobsUnassigned', 'acceptedJobsUnscheduled', 'stockLow'],
  TECHNICIAN: ['jobsToday'],
  ACCOUNTANT: ['outstandingAmount', 'outstandingInvoices'],
};
const SALES_ROLES = ['ADMIN', 'SALES', 'MANAGER'];
const OPS_ROLES = ['ADMIN', 'DISPATCHER', 'MANAGER'];
const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT'];

/** Role-aware dashboard payload — one call per login instead of a dozen. */
export async function dashboard(role) {
  const last30 = { gte: addDays(new Date(), -30) };
  const sales = SALES_ROLES.includes(role);
  const ops = OPS_ROLES.includes(role);
  const finance = FINANCE_ROLES.includes(role);

  const [
    leadsToday, leadsOpen, slaBreached, slaAtRisk,
    jobsToday, jobsOpen, jobsUnassigned,
    invoicesOutstanding, warrantiesActive, amcRenewals,
    quotationsPendingApproval, quotationsChangesRequested, quotationsAwaitingCustomer, acceptedJobsUnscheduled,
    stockLow,
  ] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null, createdAt: today() } }),
    prisma.lead.count({ where: { deletedAt: null, status: OPEN_LEAD } }),
    prisma.lead.count({ where: { deletedAt: null, ...slaWhere('breached') } }),
    prisma.lead.count({ where: { deletedAt: null, ...slaWhere('at_risk') } }),
    prisma.job.count({ where: { deletedAt: null, scheduledStart: today() } }),
    prisma.job.count({ where: { deletedAt: null, status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] } } }),
    prisma.job.count({ where: { deletedAt: null, assignments: { none: {} }, status: { in: ['DRAFT', 'SCHEDULED'] } } }),
    prisma.invoice.aggregate({
      where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, paidAmount: true }, _count: { _all: true },
    }),
    prisma.warranty.count({ where: { status: 'ACTIVE', endsAt: { gte: new Date() } } }),
    prisma.amcContract.count({ where: { deletedAt: null, status: 'active', endDate: { lte: addDays(new Date(), 60) } } }),
    prisma.quotation.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.quotation.count({ where: { deletedAt: null, status: 'CHANGES_REQUESTED' } }),
    prisma.quotation.count({ where: { deletedAt: null, status: 'SENT' } }),
    // Work the customer accepted that nobody has put on the calendar yet.
    prisma.job.count({ where: { deletedAt: null, quotationId: { not: null }, status: 'DRAFT', scheduledStart: null } }),
    // Only the roles that see the card pay for the balance sums.
    ['ADMIN', 'DISPATCHER'].includes(role) ? lowStockCount() : 0,
  ]);

  const outstanding = (invoicesOutstanding._sum.total ?? 0) - (invoicesOutstanding._sum.paidAmount ?? 0);

  const cards = {
    leadsToday, leadsOpen, slaBreached, slaAtRisk,
    jobsToday, jobsOpen, jobsUnassigned,
    outstandingAmount: outstanding, outstandingInvoices: invoicesOutstanding._count._all,
    warrantiesActive, amcRenewals,
    quotationsPendingApproval, quotationsChangesRequested, quotationsAwaitingCustomer, acceptedJobsUnscheduled,
    stockLow,
  };
  const allowed = role === 'ADMIN' ? Object.keys(cards) : VISIBLE_CARDS[role] ?? [];

  // Each widget is only computed for the roles that are shown it.
  const skip = null;
  const [
    funnel, sla, sources, trend, heatmap, queue, pipeline,
    week, jobStatus, runSheet, load,
    revenue,
  ] = await Promise.all([
    sales ? conversionFunnel({ from: last30.gte }) : skip,
    sales ? slaComplianceReport({ from: last30.gte }) : skip,
    sales ? leadSourceReport({ from: last30.gte }) : skip,
    sales ? leadTrend(14) : skip,
    sales ? leadHeatmap(30) : skip,
    sales ? slaQueue(6) : skip,
    sales ? quotationPipeline(30) : skip,
    ops ? jobsWeek() : skip,
    ops ? openJobsByStatus() : skip,
    ops ? todaysJobs(8) : skip,
    ops ? technicianLoad() : skip,
    finance ? revenueReport({ from: last30.gte, groupBy: 'day' }) : skip,
  ]);

  return {
    role,
    cards: Object.fromEntries(Object.entries(cards).filter(([k]) => allowed.includes(k))),
    ...(sales ? { funnel, sla, sources, leadTrend: trend, leadHeatmap: heatmap, slaQueue: queue, quotationPipeline: pipeline } : {}),
    ...(ops ? { jobsWeek: week, jobStatus, todaysJobs: runSheet, technicianLoad: load } : {}),
    ...(finance ? { revenue } : {}),
  };
}
