import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta } from '../utils/pagination.js';
import { nextNumber } from '../utils/numbering.js';
import { addDays, kathmanduDayRange, local } from '../utils/dates.js';
import { toPaisa } from '../utils/money.js';
import { webUrl } from '../utils/links.js';
import { AUDIT_EVENTS } from '../shared/enums.js';
import { notify, notifyRoles } from './notify.service.js';
import { recordEvent } from './audit.service.js';
import { createJob } from './job.service.js';

const INCLUDE = {
  job: { select: { id: true, number: true, title: true, type: true, actualEnd: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  claims: { orderBy: { createdAt: 'desc' } },
};

/** The customer's certificate page. */
const certificateUrl = (token) => (token ? webUrl(`/warranty/${token}`) : null);

/** The free jobs accepted claims created, by id — a claim row stores only the id. */
async function resolvedJobs(claims) {
  const ids = [...new Set(claims.map((c) => c.resolvedJobId).filter(Boolean))];
  if (!ids.length) return new Map();
  const jobs = await prisma.job.findMany({ where: { id: { in: ids } }, select: { id: true, number: true, status: true } });
  return new Map(jobs.map((j) => [j.id, j]));
}

async function presentWarranty(w) {
  const jobs = await resolvedJobs(w.claims ?? []);
  return {
    ...w,
    publicUrl: certificateUrl(w.publicToken),
    claims: (w.claims ?? []).map((c) => ({ ...c, resolvedJob: jobs.get(c.resolvedJobId) ?? null })),
  };
}

/**
 * GET /admin/warranties — `status`, `activeOnly`, `expiringDays` (active ones ending within N days) and `q`
 * (the customer's name or phone, the job's number).
 */
export async function listWarranties(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-endsAt' });
  const now = new Date();
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.activeOnly ? { status: 'ACTIVE', endsAt: { gte: now } } : {}),
    ...(query.expiringDays ? { status: 'ACTIVE', endsAt: { gte: now, lte: addDays(now, query.expiringDays) } } : {}),
    ...(q ? {
      OR: [
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q } } },
        { job: { number: { contains: q, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.warranty.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.warranty.count({ where }),
  ]);
  return { items: items.map((w) => ({ ...w, publicUrl: certificateUrl(w.publicToken) })), meta: meta({ page, limit, total }) };
}

async function findWarranty(id) {
  const w = await prisma.warranty.findUnique({ where: { id }, include: INCLUDE });
  if (!w) throw notFound('Warranty');
  return w;
}

/** GET /admin/warranties/:id — its certificate link, and each claim with the free job it made. */
export async function getWarranty(id) {
  return presentWarranty(await findWarranty(id));
}

/** The scope and the end date. The status is the server's: claims and the expiry sweep move it; voiding says why. */
export async function updateWarranty(id, data) {
  const w = await findWarranty(id);
  if (w.status === 'VOID') throw unprocessable('A void warranty cannot be changed');
  await prisma.warranty.update({ where: { id }, data });
  return getWarranty(id);
}

/** POST /admin/warranties/:id/void — the certificate stops covering the work, with the reason recorded. */
export async function voidWarranty(id, reason) {
  const w = await findWarranty(id);
  if (w.status === 'VOID') throw unprocessable('This warranty is already void');
  await prisma.$transaction(async (tx) => {
    await tx.warranty.update({ where: { id }, data: { status: 'VOID', voidReason: reason } });
    await recordEvent(AUDIT_EVENTS.WARRANTY_VOIDED, {
      model: 'Warranty', recordId: id, before: { status: w.status }, after: { status: 'VOID' }, meta: { reason },
    }, tx);
  });
  return getWarranty(id);
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

const CLAIM_INCLUDE = {
  warranty: {
    select: {
      id: true, status: true, endsAt: true, publicToken: true,
      job: {
        select: {
          id: true, number: true, title: true, type: true,
          lead: { select: { service: { select: { name: true } } } },
          quotation: { select: { lead: { select: { service: { select: { name: true } } } } } },
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
};

/** A claim's job carries `service` — the name the warranty-claims report groups by — instead of its lead chain. */
const withService = (claim) => {
  const { lead, quotation, ...job } = claim.warranty.job;
  return { ...claim, warranty: { ...claim.warranty, job: { ...job, service: lead?.service?.name ?? quotation?.lead?.service?.name ?? null } } };
};

/** The queue's order: open claims first, then accepted (a job under way), then the closed ones. */
const CLAIM_ORDER = { open: 0, accepted: 1, rejected: 2, resolved: 3 };

async function presentClaims(claims) {
  const jobs = await resolvedJobs(claims);
  return claims.map((c) => ({ ...withService(c), resolvedJob: jobs.get(c.resolvedJobId) ?? null }));
}

/**
 * GET /admin/warranty-claims — open first, then accepted, then the rest; newest first within each. `q` finds
 * the customer, their phone or the job number.
 */
export async function listClaims(query) {
  const { page, limit, skip, take, q } = parseListQuery(query);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(q ? {
      OR: [
        { warranty: { customer: { name: { contains: q, mode: 'insensitive' } } } },
        { warranty: { customer: { phone: { contains: q } } } },
        { warranty: { job: { number: { contains: q, mode: 'insensitive' } } } },
      ],
    } : {}),
  };
  // The status order is not alphabetical, so each page is read status by status.
  const statuses = query.status ? [query.status] : Object.keys(CLAIM_ORDER);
  const counts = await Promise.all(statuses.map((st) => prisma.warrantyClaim.count({ where: { ...where, status: st } })));
  const items = [];
  let offset = skip;
  let remaining = take;
  for (let i = 0; i < statuses.length && remaining > 0; i += 1) {
    if (offset >= counts[i]) { offset -= counts[i]; continue; }
    const rows = await prisma.warrantyClaim.findMany({
      where: { ...where, status: statuses[i] }, include: CLAIM_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset, take: remaining,
    });
    items.push(...rows);
    remaining -= rows.length;
    offset = 0;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return { items: await presentClaims(items), meta: meta({ page, limit, total }) };
}

/** GET /admin/warranty-claims/:id — where the claim notification links. */
export async function getClaim(id) {
  const claim = await prisma.warrantyClaim.findUnique({ where: { id }, include: CLAIM_INCLUDE });
  if (!claim) throw notFound('Claim');
  return (await presentClaims([claim]))[0];
}

const decided = (claim) => new AppError(422, 'CLAIM_DECIDED', `This claim is already ${claim.status}.`);

/**
 * PATCH /admin/warranty-claims/:id. Accept or reject an OPEN claim; resolve an open or accepted one — else
 * 422 CLAIM_DECIDED. Each decision is claimed with a guarded update, so two dispatchers pressing Accept at once
 * make one free job, not two.
 *
 * Accepting creates a zero-cost WARRANTY job linked back to the original (unassigned, so it lands in the
 * dispatch queue; SCHEDULED when a start is given) — that is what makes the promise operational. The customer
 * is told in their language, the time in Kathmandu. Audited as `warranty.claim_decided`.
 */
export async function decideClaim(claimId, { status, rejectReason, scheduledStart }, userId) {
  const claim = await prisma.warrantyClaim.findUnique({
    where: { id: claimId },
    include: { warranty: { include: { job: true, customer: true } } },
  });
  if (!claim) throw notFound('Claim');
  const from = status === 'resolved' ? ['open', 'accepted'] : ['open'];
  if (!from.includes(claim.status)) throw decided(claim);
  const { customer } = claim.warranty;

  const claimIt = async (tx, data) => {
    const { count } = await tx.warrantyClaim.updateMany({ where: { id: claimId, status: { in: from } }, data });
    if (!count) throw decided(await tx.warrantyClaim.findUnique({ where: { id: claimId } }));
  };
  const audit = (tx, meta) => recordEvent(AUDIT_EVENTS.WARRANTY_CLAIM_DECIDED, {
    model: 'WarrantyClaim', recordId: claimId, before: { status: claim.status }, after: { status }, meta,
  }, tx);

  if (status === 'rejected') {
    await prisma.$transaction(async (tx) => {
      await claimIt(tx, { status: 'rejected', rejectReason });
      await tx.warranty.update({ where: { id: claim.warrantyId }, data: { status: 'ACTIVE' } });
      await audit(tx, { rejectReason });
    });
    await notify({
      templateKey: 'warranty_claim_rejected', channel: 'sms', to: customer.phone, locale: customer.preferredLocale,
      vars: { customerName: customer.name, reason: rejectReason, appName: env.appName },
      related: { model: 'WarrantyClaim', id: claimId },
      fallbackBody: 'Regarding your warranty claim: {{reason}}. Please call us to discuss. - {{appName}}',
    });
    return getClaim(claimId);
  }

  if (status === 'resolved') {
    await prisma.$transaction(async (tx) => {
      await claimIt(tx, { status: 'resolved', resolvedAt: new Date() });
      // A voided or lapsed warranty keeps its status; a claimed one covers the work again.
      if (claim.warranty.status === 'CLAIMED') await tx.warranty.update({ where: { id: claim.warrantyId }, data: { status: 'ACTIVE' } });
      await audit(tx, {});
    });
    return getClaim(claimId);
  }

  // accepted → the free rework job, through createJob so it is numbered, evented and audited like any other.
  const original = claim.warranty.job;
  const job = await prisma.$transaction(async (tx) => {
    await claimIt(tx, { status: 'accepted' });
    const created = await createJob({
      type: 'WARRANTY',
      customerId: claim.warranty.customerId,
      siteId: original.siteId ?? undefined,
      parentJobId: original.id,
      title: `Warranty rework — ${original.title}`,
      description: claim.description,
      priority: 'HIGH',
      ...(scheduledStart ? { scheduledStart } : {}),
      isBillable: false,
    }, userId, tx);
    await tx.warrantyClaim.update({ where: { id: claimId }, data: { resolvedJobId: created.id } });
    await audit(tx, { jobId: created.id, jobNumber: created.number });
    return created;
  });

  await notify({
    templateKey: 'warranty_claim_accepted', channel: 'sms', to: customer.phone, locale: customer.preferredLocale,
    vars: {
      customerName: customer.name, number: job.number,
      when: scheduledStart ? local(scheduledStart, 'D MMM YYYY HH:mm') : (customer.preferredLocale === 'ne' ? 'छिट्टै' : 'shortly'),
      appName: env.appName,
    },
    related: { model: 'Job', id: job.id },
    fallbackBody: 'Your warranty claim is accepted. Job {{number}} is scheduled {{when}} at no charge. - {{appName}}',
  });
  await notifyRoles(['DISPATCHER'], {
    type: 'warranty_job', title: `Free warranty job ${job.number} to schedule`, body: original.title, link: `/admin/jobs/${job.id}`,
  });

  return getClaim(claimId);
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
  visits: { orderBy: { dueDate: 'asc' }, include: { job: { select: { id: true, number: true, status: true, scheduledStart: true } } } },
};

/**
 * The visits a contract lays down: `visitsPerYear` pro rata over its span, evenly spaced, the first one
 * interval after the start and the last on or before the end. Create and its preview both use this, so what
 * the sheet shows is what is saved.
 * @returns {{ totalVisits: number, intervalDays: number, visits: { dueDate: Date }[] }}
 */
export function amcSchedule({ startDate, endDate, visitsPerYear }) {
  const spanDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
  const totalVisits = Math.max(1, Math.round((visitsPerYear * spanDays) / 365));
  const intervalDays = Math.floor(spanDays / totalVisits);
  return {
    totalVisits,
    intervalDays,
    visits: Array.from({ length: totalVisits }, (_, i) => ({ dueDate: addDays(startDate, intervalDays * (i + 1)) })),
  };
}

/** GET /admin/amc-contracts — `status`, `renewalsDays` (active ones ending within N days) and `q`. */
export async function listContracts(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-startDate' });
  const now = new Date();
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.renewalsDays ? { status: 'active', endDate: { gte: now, lte: addDays(now, query.renewalsDays) } } : {}),
    ...(q ? {
      OR: [
        { number: { contains: q, mode: 'insensitive' } },
        { planName: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ],
    } : {}),
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

/** Creating a contract also lays down its visit schedule (`amcSchedule`). */
export async function createContract(input) {
  const { amount, visitsPerYear, startDate, endDate, ...rest } = input;
  const { visits } = amcSchedule({ startDate, endDate, visitsPerYear });
  if (rest.siteId) {
    const site = await prisma.customerSite.findFirst({ where: { id: rest.siteId, customerId: rest.customerId, deletedAt: null } });
    if (!site) throw unprocessable('That site does not belong to this customer');
  }

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'AMC');
    return tx.amcContract.create({
      data: {
        ...rest,
        number,
        startDate, endDate, visitsPerYear,
        amount: toPaisa(amount),
        visits: { create: visits },
      },
      include: AMC_INCLUDE,
    });
  });
}

/** Everything but the schedule (the schema refuses it): a new schedule is a renewal — a new contract. */
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

/** GET /admin/service-reminders — `status`, `customerId`, `from`/`to` (Kathmandu days on dueAt) and `q`. */
export async function listReminders(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: 'dueAt' });
  const due = kathmanduDayRange(query.from, query.to);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(due ? { dueAt: due } : {}),
    ...(q ? {
      OR: [
        { message: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q } } },
      ],
    } : {}),
  };
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

/** Only a pending reminder can be removed: one that went out (or failed) is the customer's history. */
export async function deleteReminder(id) {
  const row = await prisma.serviceReminder.findUnique({ where: { id } });
  if (!row) throw notFound('Service reminder');
  if (row.status !== 'pending') {
    throw unprocessable(`This reminder was already ${row.status} and stays on record`);
  }
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
    const log = await notify({
      templateKey: 'service_reminder', channel: r.channel, to, locale: r.customer.preferredLocale,
      vars: { customerName: r.customer.name, message: r.message, appName: env.appName },
      related: { model: 'ServiceReminder', id: r.id },
      fallbackSubject: `A reminder from ${env.appName}`,
      fallbackBody: '{{message}}',
    });
    // The provider's answer decides it (Phase I): a refused message is `failed`, visible in the list, not `sent`.
    const failed = !log || log.status === 'failed';
    await prisma.serviceReminder.update({ where: { id: r.id }, data: failed ? { status: 'failed' } : { status: 'sent', sentAt: new Date() } });
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
