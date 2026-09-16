import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta } from '../utils/pagination.js';
import { nextNumber } from '../utils/numbering.js';
import { addDays } from '../utils/dates.js';
import { toPaisa } from '../utils/money.js';
import { notify, notifyRoles } from './notify.service.js';

const INCLUDE = {
  job: { select: { id: true, number: true, title: true, type: true, actualEnd: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  claims: { orderBy: { createdAt: 'desc' } },
};

export async function listWarranties(query) {
  const { page, limit, skip, take, orderBy } = parseListQuery(query, { defaultSort: '-endsAt' });
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.activeOnly ? { status: 'ACTIVE', endsAt: { gte: new Date() } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.warranty.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.warranty.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getWarranty(id) {
  const w = await prisma.warranty.findUnique({ where: { id }, include: INCLUDE });
  if (!w) throw notFound('Warranty');
  return w;
}

export async function updateWarranty(id, data) {
  await getWarranty(id);
  return prisma.warranty.update({ where: { id }, data, include: INCLUDE });
}

export async function expiringSoon(days = 30) {
  return prisma.warranty.findMany({
    where: { status: 'ACTIVE', endsAt: { gte: new Date(), lte: addDays(new Date(), days) } },
    include: INCLUDE,
    orderBy: { endsAt: 'asc' },
  });
}

/** Customer-facing warranty certificate view, resolved by public token. */
export async function getByPublicToken(token) {
  const w = await prisma.warranty.findFirst({
    where: { publicToken: token },
    include: {
      job: { select: { number: true, title: true, actualEnd: true, completionNote: true } },
      customer: { select: { name: true, phone: true } },
      claims: { select: { id: true, description: true, status: true, createdAt: true } },
    },
  });
  if (!w) throw notFound('Warranty');
  return { ...w, isValid: w.status === 'ACTIVE' && w.endsAt >= new Date() };
}

/** A customer raises a claim from the certificate link — no login required. */
export async function claimByToken(token, { description }) {
  const w = await prisma.warranty.findFirst({ where: { publicToken: token }, include: { customer: true, job: true } });
  if (!w) throw notFound('Warranty');
  if (w.status === 'VOID') throw unprocessable('This warranty has been voided');
  if (w.endsAt < new Date()) {
    throw unprocessable(`This warranty expired on ${w.endsAt.toISOString().slice(0, 10)}. We can still help — please call us.`);
  }
  const open = await prisma.warrantyClaim.findFirst({ where: { warrantyId: w.id, status: { in: ['open', 'accepted'] } } });
  if (open) throw unprocessable('You already have an open claim for this job. We will be in touch shortly.');

  const claim = await prisma.$transaction(async (tx) => {
    const c = await tx.warrantyClaim.create({ data: { warrantyId: w.id, description } });
    await tx.warranty.update({ where: { id: w.id }, data: { status: 'CLAIMED' } });
    return c;
  });

  await notifyRoles(['ADMIN', 'DISPATCHER'], {
    type: 'warranty_claim',
    title: `Warranty claim — ${w.customer.name}`,
    body: `Job ${w.job.number}: ${description.slice(0, 120)}`,
    link: `/admin/warranty-claims/${claim.id}`,
  });
  return claim;
}

export async function listClaims(query) {
  const { page, limit, skip, take, orderBy } = parseListQuery(query);
  const where = { ...(query.status ? { status: query.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where, orderBy, skip, take,
      include: { warranty: { include: INCLUDE } },
    }),
    prisma.warrantyClaim.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * Accepting a claim creates a zero-cost WARRANTY job linked back to the original.
 * That is what makes the 1-month promise operational rather than decorative.
 */
export async function decideClaim(claimId, { status, rejectReason, scheduledStart }, userId) {
  const claim = await prisma.warrantyClaim.findUnique({
    where: { id: claimId },
    include: { warranty: { include: { job: true, customer: true } } },
  });
  if (!claim) throw notFound('Claim');
  if (claim.status === 'resolved') throw unprocessable('This claim is already resolved');

  if (status === 'rejected') {
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.warrantyClaim.update({ where: { id: claimId }, data: { status: 'rejected', rejectReason } });
      await tx.warranty.update({ where: { id: claim.warrantyId }, data: { status: 'ACTIVE' } });
      return c;
    });
    await notify({
      templateKey: 'warranty_claim_rejected', channel: 'sms', to: claim.warranty.customer.phone,
      locale: claim.warranty.customer.preferredLocale,
      vars: { customerName: claim.warranty.customer.name, reason: rejectReason, appName: env.appName },
      related: { model: 'WarrantyClaim', id: claimId },
      fallbackBody: 'Regarding your warranty claim: {{reason}}. Please call us to discuss. - {{appName}}',
    });
    return updated;
  }

  if (status === 'resolved') {
    return prisma.$transaction(async (tx) => {
      const c = await tx.warrantyClaim.update({ where: { id: claimId }, data: { status: 'resolved', resolvedAt: new Date() } });
      await tx.warranty.update({ where: { id: claim.warrantyId }, data: { status: 'ACTIVE' } });
      return c;
    });
  }

  // accepted -> spin up the free rework job
  const original = claim.warranty.job;
  const job = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'JOB');
    const created = await tx.job.create({
      data: {
        number,
        type: 'WARRANTY',
        customerId: claim.warranty.customerId,
        siteId: original.siteId,
        parentJobId: original.id,
        title: `Warranty rework — ${original.title}`,
        description: claim.description,
        priority: 'HIGH',
        status: scheduledStart ? 'SCHEDULED' : 'DRAFT',
        scheduledStart: scheduledStart ?? null,
        isBillable: false,
        createdById: userId ?? null,
      },
    });
    await tx.jobStatusEvent.create({
      data: { jobId: created.id, to: created.status, actorId: userId ?? null, note: `Created from warranty claim ${claimId}` },
    });
    await tx.warrantyClaim.update({ where: { id: claimId }, data: { status: 'accepted', resolvedJobId: created.id } });
    return created;
  });

  await notify({
    templateKey: 'warranty_claim_accepted', channel: 'sms', to: claim.warranty.customer.phone,
    locale: claim.warranty.customer.preferredLocale,
    vars: {
      customerName: claim.warranty.customer.name, number: job.number,
      when: scheduledStart ? new Date(scheduledStart).toLocaleString() : 'shortly', appName: env.appName,
    },
    related: { model: 'Job', id: job.id },
    fallbackBody: 'Your warranty claim is accepted. Job {{number}} is scheduled {{when}} at no charge. - {{appName}}',
  });

  return { claim: await prisma.warrantyClaim.findUnique({ where: { id: claimId } }), job };
}

/** Daily sweep: expire warranties whose window has passed. */
export async function sweepExpired() {
  const { count } = await prisma.warranty.updateMany({
    where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return { expired: count };
}

// ── AMC contracts

const AMC_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  site: { select: { id: true, label: true, address: true } },
  visits: { orderBy: { dueDate: 'asc' } },
};

export async function listContracts(query) {
  const { page, limit, skip, take, orderBy } = parseListQuery(query, { defaultSort: '-startDate' });
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.amcContract.findMany({ where, orderBy, skip, take, include: AMC_INCLUDE }),
    prisma.amcContract.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getContract(id) {
  const c = await prisma.amcContract.findFirst({ where: { id, deletedAt: null }, include: AMC_INCLUDE });
  if (!c) throw notFound('AMC contract');
  return c;
}

/** Creating a contract also lays down its visit schedule, evenly spaced. */
export async function createContract(input) {
  const { amount, visitsPerYear, startDate, endDate, ...rest } = input;
  const spanDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
  const totalVisits = Math.max(1, Math.round((visitsPerYear * spanDays) / 365));
  const interval = Math.floor(spanDays / totalVisits);

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'AMC');
    return tx.amcContract.create({
      data: {
        ...rest,
        number,
        startDate, endDate, visitsPerYear,
        amount: toPaisa(amount),
        visits: {
          create: Array.from({ length: totalVisits }, (_, i) => ({
            dueDate: addDays(startDate, interval * (i + 1)),
          })),
        },
      },
      include: AMC_INCLUDE,
    });
  });
}

export async function updateContract(id, data) {
  await getContract(id);
  const { amount, ...rest } = data;
  return prisma.amcContract.update({
    where: { id },
    data: { ...rest, ...(amount !== undefined ? { amount: toPaisa(amount) } : {}) },
    include: AMC_INCLUDE,
  });
}

export async function deleteContract(id) {
  await prisma.amcContract.update({ where: { id }, data: { deletedAt: new Date(), status: 'cancelled' } });
}

export async function renewalsDue(days = 60) {
  return prisma.amcContract.findMany({
    where: { deletedAt: null, status: 'active', endDate: { gte: new Date(), lte: addDays(new Date(), days) } },
    include: AMC_INCLUDE,
    orderBy: { endDate: 'asc' },
  });
}

/**
 * Cron: turns AMC visits due within a week into real scheduled jobs and reminds
 * the customer. This is the recurring-revenue engine.
 */
export async function materialiseAmcVisits(daysAhead = 7) {
  const visits = await prisma.amcVisit.findMany({
    where: {
      status: 'pending',
      jobId: null,
      dueDate: { lte: addDays(new Date(), daysAhead) },
      contract: { status: 'active', deletedAt: null },
    },
    include: { contract: { include: { customer: true, site: true } } },
    take: 200,
  });

  let created = 0;
  for (const visit of visits) {
    const { contract } = visit;
    const job = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'JOB');
      const j = await tx.job.create({
        data: {
          number,
          type: 'AMC_VISIT',
          customerId: contract.customerId,
          siteId: contract.siteId,
          title: `AMC visit — ${contract.planName}`,
          description: `Scheduled preventive maintenance under contract ${contract.number}`,
          status: 'SCHEDULED',
          scheduledStart: visit.dueDate,
          isBillable: false,
        },
      });
      await tx.jobStatusEvent.create({ data: { jobId: j.id, to: 'SCHEDULED', note: `AMC contract ${contract.number}` } });
      await tx.amcVisit.update({ where: { id: visit.id }, data: { jobId: j.id, status: 'scheduled' } });
      return j;
    });
    created += 1;

    await notify({
      templateKey: 'amc_visit_due', channel: 'sms', to: contract.customer.phone, locale: contract.customer.preferredLocale,
      vars: {
        customerName: contract.customer.name, planName: contract.planName,
        date: visit.dueDate.toISOString().slice(0, 10), number: job.number, appName: env.appName,
      },
      related: { model: 'Job', id: job.id },
      fallbackBody: 'Your {{planName}} maintenance visit is due on {{date}}. We will confirm the time. - {{appName}}',
    });
  }

  // Mark visits nobody serviced.
  const { count: missed } = await prisma.amcVisit.updateMany({
    where: { status: 'pending', dueDate: { lt: addDays(new Date(), -14) } },
    data: { status: 'missed' },
  });

  return { created, missed };
}

/** Expire contracts past their end date and alert sales about renewals. */
export async function sweepContracts() {
  const { count } = await prisma.amcContract.updateMany({
    where: { status: 'active', endDate: { lt: new Date() } },
    data: { status: 'expired' },
  });
  const due = await renewalsDue(30);
  if (due.length) {
    await notifyRoles(['ADMIN', 'SALES', 'MANAGER'], {
      type: 'amc_renewals', title: `${due.length} AMC contract(s) renew within 30 days`, link: '/admin/amc-contracts?renewals=true',
    });
  }
  return { expired: count, renewalsDue: due.length };
}

// ── service reminders

export async function listReminders(query) {
  const { page, limit, skip, take, orderBy } = parseListQuery(query, { defaultSort: 'dueAt' });
  const where = { ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customerId: query.customerId } : {}) };
  const [items, total] = await Promise.all([
    prisma.serviceReminder.findMany({ where, orderBy, skip, take, include: { customer: { select: { id: true, name: true, phone: true } } } }),
    prisma.serviceReminder.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function createReminder(data) {
  return prisma.serviceReminder.create({ data });
}

/** A pending reminder can be moved or reworded; one already sent is history. */
export async function updateReminder(id, data) {
  const row = await prisma.serviceReminder.findUnique({ where: { id } });
  if (!row) throw notFound('Service reminder');
  if (row.status !== 'pending') {
    throw unprocessable(`This reminder was already ${row.status} and can no longer be changed`);
  }
  return prisma.serviceReminder.update({ where: { id }, data });
}

export async function deleteReminder(id) {
  await prisma.serviceReminder.delete({ where: { id } });
}

/** Cron: sends every reminder that has come due. */
export async function dispatchReminders() {
  const due = await prisma.serviceReminder.findMany({
    where: { status: 'pending', dueAt: { lte: new Date() } },
    include: { customer: { select: { name: true, phone: true, email: true, preferredLocale: true } } },
    take: 200,
  });
  for (const r of due) {
    const to = r.channel === 'email' ? r.customer.email : r.customer.phone;
    if (!to) {
      await prisma.serviceReminder.update({ where: { id: r.id }, data: { status: 'skipped' } });
      continue;
    }
    await notify({
      templateKey: 'service_reminder', channel: r.channel, to, locale: r.customer.preferredLocale,
      vars: { customerName: r.customer.name, appName: env.appName },
      related: { model: 'ServiceReminder', id: r.id },
      fallbackSubject: `A reminder from ${env.appName}`,
      fallbackBody: r.message,
    });
    await prisma.serviceReminder.update({ where: { id: r.id }, data: { status: 'sent', sentAt: new Date() } });
  }
  return { sent: due.length };
}

/**
 * Auto-generates a follow-up 11 months after a completed job, so seasonal work
 * (waterproofing before monsoon) comes back around on its own.
 */
export async function scheduleFollowUp(jobId) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: true } });
  if (!job || !job.actualEnd) return null;
  const exists = await prisma.serviceReminder.findFirst({ where: { jobId } });
  if (exists) return exists;
  return prisma.serviceReminder.create({
    data: {
      customerId: job.customerId,
      jobId,
      dueAt: addDays(job.actualEnd, 330),
      channel: 'sms',
      message: `Hello ${job.customer.name}, it has been almost a year since we completed "${job.title}". Would you like a free check-up before the season? - ${env.appName}`,
    },
  });
}
