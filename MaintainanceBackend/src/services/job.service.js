import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound, badRequest, forbidden, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr, dateRange } from '../utils/pagination.js';
import { nextNumber } from '../utils/numbering.js';
import { toPaisa, sum } from '../utils/money.js';
import { addDays, startOfDay, endOfDay } from '../utils/dates.js';
import { JOB_TRANSITIONS, QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { publicToken } from '../utils/tokens.js';
import { markConverted } from './quotation.service.js';
import { issueToJob } from './material.service.js';

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  site: { select: { id: true, label: true, address: true, area: true, lat: true, lng: true, accessNotes: true } },
  quotation: { select: { id: true, number: true, total: true } },
  assignments: {
    include: { technician: { include: { user: { select: { id: true, name: true, phone: true } } } } },
  },
  tasks: { orderBy: { sortOrder: 'asc' } },
};

export async function listJobs(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-createdAt' });
  const scheduled = dateRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.technicianId ? { assignments: { some: { technicianId: query.technicianId } } } : {}),
    ...(query.unassigned ? { assignments: { none: {} } } : {}),
    ...(scheduled ? { scheduledStart: scheduled } : {}),
    ...(q ? { OR: [...searchOr(q, ['number', 'title', 'description']), { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.job.findMany({ where, orderBy, skip, take, include: INCLUDE }),
    prisma.job.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getJob(id) {
  const job = await prisma.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...INCLUDE,
      lead: { select: { id: true, name: true, phone: true } },
      photos: { orderBy: { createdAt: 'asc' } },
      timeLogs: { include: { technician: { include: { user: { select: { id: true, name: true } } } } }, orderBy: { startedAt: 'asc' } },
      materials: { include: { material: { select: { id: true, code: true, name: true, unit: true } } } },
      events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true } } } },
      warranty: true,
      childJobs: { select: { id: true, number: true, type: true, status: true } },
    },
  });
  if (!job) throw notFound('Job');
  return job;
}

async function recordEvent(tx, { jobId, from, to, actorId, note, lat, lng }) {
  return tx.jobStatusEvent.create({
    data: { jobId, from: from ?? null, to, actorId: actorId ?? null, note: note ?? null, lat: lat ?? null, lng: lng ?? null },
  });
}

export async function createJob(input, userId) {
  const { technicianIds = [], leadTechnicianId, templateId, ...rest } = input;

  const customer = await prisma.customer.findFirst({ where: { id: rest.customerId, deletedAt: null } });
  if (!customer) throw badRequest('That customer does not exist');
  if (rest.siteId) {
    const site = await prisma.customerSite.findFirst({ where: { id: rest.siteId, customerId: rest.customerId, deletedAt: null } });
    if (!site) throw badRequest('That site does not belong to this customer');
  }
  if (rest.quotationId) {
    const quotation = await prisma.quotation.findFirst({ where: { id: rest.quotationId, deletedAt: null } });
    if (!quotation) throw badRequest('That quotation does not exist');
    if (quotation.customerId !== rest.customerId) throw badRequest('That quotation belongs to another customer');
    // Only approved work becomes a job. Without this, a job pointing at a draft
    // marked it CONVERTED and the customer's approval step simply never happened.
    assertTransition(QUOTATION_TRANSITIONS, quotation.status, 'CONVERTED', 'quotation');
  }

  let tasks = [];
  if (templateId) {
    const tpl = await prisma.jobTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
    if (!tpl) throw badRequest('That job template does not exist');
    tasks = (tpl.tasks ?? []).map((t, i) => ({ title: t.title, note: t.description ?? null, sortOrder: i }));
  }

  const status = technicianIds.length ? 'ASSIGNED' : rest.scheduledStart ? 'SCHEDULED' : 'DRAFT';

  const job = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, 'JOB');
    const created = await tx.job.create({
      data: {
        ...rest,
        number,
        status,
        createdById: userId ?? null,
        ...(tasks.length ? { tasks: { create: tasks } } : {}),
        ...(technicianIds.length
          ? {
              assignments: {
                create: technicianIds.map((tid) => ({
                  technicianId: tid,
                  isLead: tid === (leadTechnicianId ?? technicianIds[0]),
                })),
              },
            }
          : {}),
      },
      include: INCLUDE,
    });
    await recordEvent(tx, { jobId: created.id, from: null, to: status, actorId: userId, note: 'Job created' });
    if (rest.quotationId) await markConverted(rest.quotationId, tx);
    return created;
  });

  if (technicianIds.length) await announceAssignment(job, technicianIds);
  return job;
}

/**
 * The work order that carries out an approved quotation.
 *
 * The quotation already knows the customer, the site and the lead, so the
 * dispatcher supplies only what it does not: when, who, and which checklist.
 * createJob asserts APPROVED -> CONVERTED, so a draft or a declined quotation
 * cannot become work by this route either.
 */
export async function createJobFromQuotation(quotationId, input, userId) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, deletedAt: null },
    include: {
      lead: { select: { service: { select: { name: true } } } },
      items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { description: true } },
    },
  });
  if (!quotation) throw notFound('Quotation');
  const { title, ...rest } = input;
  const what = quotation.lead?.service?.name ?? quotation.items[0]?.description ?? 'Work';
  return createJob({
    ...rest,
    customerId: quotation.customerId,
    siteId: quotation.siteId,
    leadId: quotation.leadId,
    quotationId: quotation.id,
    title: title ?? `${what} — ${quotation.number}`,
  }, userId);
}

async function announceAssignment(job, technicianIds) {
  const techs = await prisma.technician.findMany({
    where: { id: { in: technicianIds } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  for (const t of techs) {
    await prisma.notification.create({
      data: {
        userId: t.userId, type: 'job_assigned',
        title: `New job — ${job.number}`,
        body: `${job.title}${job.scheduledStart ? ` · ${new Date(job.scheduledStart).toLocaleString()}` : ''}`,
        link: `/tech/jobs/${job.id}`,
      },
    });
    if (t.user.phone) {
      await notify({
        templateKey: 'job_assigned', channel: 'sms', to: t.user.phone,
        vars: {
          techName: t.user.name, number: job.number, title: job.title,
          address: job.site?.address ?? '-', customer: job.customer?.name ?? '-',
          phone: job.customer?.phone ?? '-',
          when: job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : 'TBC',
        },
        related: { model: 'Job', id: job.id },
        fallbackBody: 'Job {{number}}: {{title}} at {{address}}. Customer {{customer}} {{phone}}. When: {{when}}',
      });
    }
  }
}

export async function updateJob(id, data) {
  const job = await getJob(id);
  if (['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(job.status)) {
    throw unprocessable(`A ${job.status.toLowerCase()} job cannot be edited`);
  }
  return prisma.job.update({ where: { id }, data, include: INCLUDE });
}

/**
 * Status transitions. Side effects (timestamps, warranty creation, customer SMS)
 * are driven here, never by the client.
 */
export async function changeStatus(id, { status, note, lat, lng }, userId) {
  const job = await prisma.job.findFirst({ where: { id, deletedAt: null } });
  if (!job) throw notFound('Job');
  assertTransition(JOB_TRANSITIONS, job.status, status, 'job');

  if (status === 'COMPLETED') {
    return completeJob(id, { note }, userId);
  }

  const data = { status };
  if (status === 'IN_PROGRESS' && !job.actualStart) data.actualStart = new Date();
  if (status === 'ON_HOLD') data.holdReason = note ?? null;
  if (status === 'CANCELLED') data.cancelReason = note ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.job.update({ where: { id }, data, include: INCLUDE });
    await recordEvent(tx, { jobId: id, from: job.status, to: status, actorId: userId, note, lat, lng });
    return row;
  });

  if (status === 'EN_ROUTE' && updated.customer?.phone) {
    await notify({
      templateKey: 'job_en_route', channel: 'sms', to: updated.customer.phone,
      vars: { customerName: updated.customer.name, number: updated.number, appName: env.appName },
      related: { model: 'Job', id },
      fallbackBody: 'Hi {{customerName}}, our technician is on the way for job {{number}}. - {{appName}}',
    });
  }
  return updated;
}

/**
 * Completion is the pivot of the whole system: it closes the work, creates the
 * warranty that backs the public promise, and opens the job for invoicing.
 */
export async function completeJob(id, input, userId) {
  const job = await prisma.job.findFirst({
    where: { id, deletedAt: null },
    include: { customer: true, tasks: true, quotation: { select: { id: true } }, warranty: true },
  });
  if (!job) throw notFound('Job');
  assertTransition(JOB_TRANSITIONS, job.status, 'COMPLETED', 'job');

  const pending = job.tasks.filter((t) => !t.isDone && !t.isSkipped);
  if (pending.length) {
    throw unprocessable(
      `${pending.length} checklist item(s) are still open. Complete or skip them first.`,
      pending.map((t) => ({ id: t.id, title: t.title })),
    );
  }

  const defaultDays = Number(await getSetting('warranty.defaultDays', env.business.warrantyDefaultDays));
  const warrantyDays = input.warrantyDays ?? defaultDays;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Close any timer still running.
    await tx.timeLog.updateMany({
      where: { jobId: id, endedAt: null },
      data: { endedAt: now },
    });
    const open = await tx.timeLog.findMany({ where: { jobId: id, minutes: null } });
    for (const log of open) {
      await tx.timeLog.update({
        where: { id: log.id },
        data: { minutes: Math.max(1, Math.round((now - new Date(log.startedAt)) / 60000)) },
      });
    }

    const updated = await tx.job.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEnd: now,
        actualStart: job.actualStart ?? now,
        completionNote: input.note ?? null,
        signatureId: input.signatureMediaId ?? null,
        customerRating: input.customerRating ?? null,
        customerFeedback: input.customerFeedback ?? null,
      },
      include: INCLUDE,
    });

    await recordEvent(tx, { jobId: id, from: job.status, to: 'COMPLETED', actorId: userId, note: input.note });

    let warranty = job.warranty;
    if (!warranty && warrantyDays > 0 && job.type !== 'INSPECTION') {
      warranty = await tx.warranty.create({
        data: {
          jobId: id,
          customerId: job.customerId,
          scope: input.warrantyScope ?? `Workmanship warranty for ${job.title}`,
          startsAt: now,
          endsAt: addDays(now, warrantyDays),
          publicToken: publicToken(),
        },
      });
    }

    if (input.customerRating) {
      const techs = await tx.jobAssignment.findMany({ where: { jobId: id }, select: { technicianId: true } });
      for (const t of techs) {
        const tech = await tx.technician.findUnique({ where: { id: t.technicianId } });
        if (!tech) continue;
        const count = tech.ratingCount + 1;
        const rating = (tech.rating * tech.ratingCount + input.customerRating) / count;
        await tx.technician.update({ where: { id: tech.id }, data: { rating, ratingCount: count } });
      }
    }

    return { job: updated, warranty };
  });

  const { job: updated, warranty } = result;

  // A free inspection is not "work completed" and carries no warranty — telling the
  // customer it does, with an empty warranty link, is worse than saying nothing.
  // The survey submission notifies the office instead.
  const isInspection = updated.type === 'INSPECTION';

  if (updated.customer?.phone && !isInspection) {
    const webOrigin = env.corsOrigins[0] ?? env.appUrl;
    await notify({
      templateKey: 'job_completed', channel: 'sms', to: updated.customer.phone,
      vars: {
        customerName: updated.customer.name, number: updated.number, appName: env.appName,
        warrantyDays, warrantyLink: warranty ? `${webOrigin}/warranty/${warranty.publicToken}` : '',
      },
      related: { model: 'Job', id },
      fallbackBody:
        'Job {{number}} is complete. Your work carries a {{warrantyDays}}-day warranty: {{warrantyLink}} - {{appName}}',
    });
  }
  if (!isInspection) {
    await notifyRoles(['ADMIN', 'ACCOUNTANT'], {
      type: 'job_completed',
      title: `Job ${updated.number} completed`,
      body: `${updated.customer?.name} · ready to invoice`,
      link: `/jobs/${id}`,
    });
  }

  return updated;
}

export async function verifyJob(id, userId) {
  const job = await prisma.job.findFirst({ where: { id, deletedAt: null } });
  if (!job) throw notFound('Job');
  assertTransition(JOB_TRANSITIONS, job.status, 'VERIFIED', 'job');
  return prisma.$transaction(async (tx) => {
    const row = await tx.job.update({ where: { id }, data: { status: 'VERIFIED' }, include: INCLUDE });
    await recordEvent(tx, { jobId: id, from: job.status, to: 'VERIFIED', actorId: userId });
    return row;
  });
}

export async function assignTechnicians(id, { technicianIds, leadTechnicianId, note }, userId) {
  const job = await getJob(id);
  if (['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(job.status)) {
    throw unprocessable('This job is closed and cannot be reassigned');
  }
  const found = await prisma.technician.count({ where: { id: { in: technicianIds }, deletedAt: null } });
  if (found !== technicianIds.length) throw badRequest('One or more technicians do not exist');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.jobAssignment.deleteMany({ where: { jobId: id } });
    await tx.jobAssignment.createMany({
      data: technicianIds.map((tid) => ({
        jobId: id, technicianId: tid, isLead: tid === (leadTechnicianId ?? technicianIds[0]),
      })),
    });
    const nextStatus = job.status === 'DRAFT' || job.status === 'SCHEDULED' ? 'ASSIGNED' : job.status;
    const row = await tx.job.update({ where: { id }, data: { status: nextStatus }, include: INCLUDE });
    await recordEvent(tx, { jobId: id, from: job.status, to: nextStatus, actorId: userId, note: note ?? 'Technicians assigned' });
    return row;
  });

  await announceAssignment(updated, technicianIds);
  return updated;
}

// ── tasks

export async function addTask(jobId, data) {
  await getJob(jobId);
  return prisma.jobTask.create({ data: { ...data, jobId } });
}

export async function updateTask(jobId, taskId, data) {
  const task = await prisma.jobTask.findFirst({ where: { id: taskId, jobId } });
  if (!task) throw notFound('Task');
  return prisma.jobTask.update({
    where: { id: taskId },
    data: { ...data, ...(data.isDone ? { doneAt: new Date() } : data.isDone === false ? { doneAt: null } : {}) },
  });
}

export async function deleteTask(jobId, taskId) {
  const task = await prisma.jobTask.findFirst({ where: { id: taskId, jobId } });
  if (!task) throw notFound('Task');
  await prisma.jobTask.delete({ where: { id: taskId } });
}

// ── photos

export async function addPhoto(jobId, data) {
  await getJob(jobId);
  return prisma.jobPhoto.create({ data: { ...data, jobId } });
}

export async function deletePhoto(jobId, photoId) {
  const photo = await prisma.jobPhoto.findFirst({ where: { id: photoId, jobId } });
  if (!photo) throw notFound('Photo');
  await prisma.jobPhoto.delete({ where: { id: photoId } });
}

// ── materials

export async function addMaterial(jobId, input, userId) {
  const job = await getJob(jobId);
  if (['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(job.status)) {
    throw unprocessable('Materials cannot be added to a closed job');
  }
  return issueToJob({ jobId, ...input, actorId: userId });
}

export async function removeMaterial(jobId, jobMaterialId, userId) {
  const row = await prisma.jobMaterial.findFirst({ where: { id: jobMaterialId, jobId } });
  if (!row) throw notFound('Job material');
  return prisma.$transaction(async (tx) => {
    await tx.jobMaterial.delete({ where: { id: jobMaterialId } });
    await tx.stockMovement.create({
      data: {
        materialId: row.materialId, type: 'RETURN', qty: row.qty, rate: row.rate,
        jobId, reference: `Reversal for job ${jobId}`, actorId: userId ?? null,
      },
    });
  });
}

// ── time logs

export async function startTimer(jobId, technicianId, note) {
  const running = await prisma.timeLog.findFirst({ where: { jobId, technicianId, endedAt: null } });
  if (running) throw badRequest('A timer is already running for you on this job');
  return prisma.timeLog.create({ data: { jobId, technicianId, startedAt: new Date(), note: note ?? null } });
}

export async function stopTimer(jobId, technicianId, note) {
  const running = await prisma.timeLog.findFirst({ where: { jobId, technicianId, endedAt: null }, orderBy: { startedAt: 'desc' } });
  if (!running) throw badRequest('No timer is running for you on this job');
  const endedAt = new Date();
  return prisma.timeLog.update({
    where: { id: running.id },
    data: {
      endedAt,
      minutes: Math.max(1, Math.round((endedAt - new Date(running.startedAt)) / 60000)),
      note: note ?? running.note,
    },
  });
}

/**
 * Labour an office user records by hand — the timer was never started, or the
 * work was logged on paper. Costing reads time logs, so without this a
 * forgotten timer was a job that cost nothing in labour, permanently.
 * Only a technician on the job can be credited with time on it.
 */
export async function addTimeLog(jobId, { technicianId, startedAt, endedAt, minutes, note }) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { id: true } });
  if (!job) throw notFound('Job');
  const assigned = await prisma.jobAssignment.findFirst({ where: { jobId, technicianId } });
  if (!assigned) throw unprocessable('That technician is not assigned to this job');

  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date(start.getTime() + minutes * 60_000);
  return prisma.timeLog.create({
    data: {
      jobId,
      technicianId,
      startedAt: start,
      endedAt: end,
      minutes: minutes ?? Math.max(1, Math.round((end - start) / 60_000)),
      note: note ?? null,
    },
    include: { technician: { include: { user: { select: { id: true, name: true } } } } },
  });
}

export async function removeTimeLog(jobId, logId) {
  const { count } = await prisma.timeLog.deleteMany({ where: { id: logId, jobId } });
  if (!count) throw notFound('Time log');
}

// ── costing

/** Labour + materials + expenses against what was invoiced. */
export async function jobCosting(id) {
  const job = await prisma.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      materials: { include: { material: { select: { name: true, code: true, unit: true, purchaseRate: true } } } },
      timeLogs: { include: { technician: { select: { hourlyRate: true, user: { select: { name: true } } } } } },
      expenses: true,
      invoiceItems: { include: { invoice: { select: { id: true, number: true, status: true } } } },
    },
  });
  if (!job) throw notFound('Job');

  const materialCost = sum(job.materials.map((m) => Math.round(m.qty * (m.material.purchaseRate || m.rate))));
  const materialBilled = sum(job.materials.filter((m) => m.isBillable).map((m) => Math.round(m.qty * m.rate)));
  const labourMinutes = sum(job.timeLogs.map((t) => t.minutes ?? 0));
  const labourCost = sum(job.timeLogs.map((t) => Math.round(((t.minutes ?? 0) / 60) * (t.technician.hourlyRate ?? 0))));
  const expenseCost = sum(job.expenses.map((e) => e.amount));
  const invoiced = sum(job.invoiceItems.map((i) => i.amount));
  const totalCost = materialCost + labourCost + expenseCost;

  return {
    jobId: id,
    number: job.number,
    cost: { materials: materialCost, labour: labourCost, expenses: expenseCost, total: totalCost },
    labourMinutes,
    billable: { materials: materialBilled, invoiced },
    margin: invoiced - totalCost,
    marginPct: invoiced ? Number((((invoiced - totalCost) / invoiced) * 100).toFixed(2)) : null,
    breakdown: {
      materials: job.materials.map((m) => ({
        name: m.material.name, code: m.material.code, unit: m.material.unit,
        qty: m.qty, rate: m.rate, amount: Math.round(m.qty * m.rate), isBillable: m.isBillable,
      })),
      labour: job.timeLogs.map((t) => ({
        technician: t.technician.user.name, minutes: t.minutes ?? 0,
        cost: Math.round(((t.minutes ?? 0) / 60) * (t.technician.hourlyRate ?? 0)),
      })),
      expenses: job.expenses.map((e) => ({ category: e.category, amount: e.amount, vendor: e.vendor })),
      invoices: [...new Map(job.invoiceItems.map((i) => [i.invoice.id, i.invoice])).values()],
    },
  };
}

export async function deleteJob(id) {
  const job = await getJob(id);
  if (!['DRAFT', 'CANCELLED'].includes(job.status)) {
    throw badRequest('Only draft or cancelled jobs can be deleted. Cancel the job instead.');
  }
  await prisma.job.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ── dispatch board

export async function dispatchBoard({ date, view = 'day', technicianId, role }) {
  const anchor = date ? new Date(date) : new Date();
  const from = startOfDay(anchor);
  const to = view === 'week' ? endOfDay(addDays(anchor, 6)) : endOfDay(anchor);

  const [technicians, jobs, unassigned] = await Promise.all([
    prisma.technician.findMany({
      where: {
        deletedAt: null,
        ...(technicianId ? { id: technicianId } : {}),
        ...(role ? { user: { role } } : {}),
      },
      include: { user: { select: { id: true, name: true, phone: true, role: true, isActive: true } } },
      orderBy: { employeeCode: 'asc' },
    }),
    prisma.job.findMany({
      where: { deletedAt: null, scheduledStart: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      include: INCLUDE,
      orderBy: { scheduledStart: 'asc' },
    }),
    prisma.job.findMany({
      where: { deletedAt: null, assignments: { none: {} }, status: { in: ['DRAFT', 'SCHEDULED'] } },
      include: INCLUDE,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    }),
  ]);

  const lanes = technicians
    .filter((t) => t.user.isActive)
    .map((t) => {
      const laneJobs = jobs.filter((j) => j.assignments.some((a) => a.technicianId === t.id));
      return {
        technician: { id: t.id, name: t.user.name, phone: t.user.phone, role: t.user.role, skills: t.skills, rating: t.rating, dailyCapacity: t.dailyCapacity },
        jobs: laneJobs,
        load: laneJobs.length,
        overCapacity: view === 'day' && laneJobs.length > t.dailyCapacity,
        conflicts: findConflicts(laneJobs),
      };
    });

  return { from, to, view, lanes, unassigned };
}

/** Flags overlapping scheduled windows on one technician's lane. */
function findConflicts(jobs) {
  const withTimes = jobs.filter((j) => j.scheduledStart && j.scheduledEnd);
  const clashes = [];
  for (let i = 0; i < withTimes.length; i += 1) {
    for (let k = i + 1; k < withTimes.length; k += 1) {
      const a = withTimes[i];
      const b = withTimes[k];
      if (new Date(a.scheduledStart) < new Date(b.scheduledEnd) && new Date(b.scheduledStart) < new Date(a.scheduledEnd)) {
        clashes.push({ a: a.number, b: b.number });
      }
    }
  }
  return clashes;
}

// ── technician-scoped access

/** Resolves the Technician row for a logged-in user, rejecting non-technicians. */
/** One technician. The labour rate is returned only to a caller allowed to set it. */
export async function getTechnician(id, { withRate = false } = {}) {
  const tech = await prisma.technician.findFirst({
    where: { id, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true, phone: true, role: true, isActive: true } } },
  });
  if (!tech) throw notFound('Technician');
  if (!withRate) delete tech.hourlyRate;
  return tech;
}

export async function technicianForUser(userId) {
  const tech = await prisma.technician.findFirst({ where: { userId, deletedAt: null } });
  if (!tech) throw forbidden('Your account is not linked to a technician profile');
  return tech;
}

export async function assertAssigned(jobId, technicianId) {
  const assignment = await prisma.jobAssignment.findFirst({ where: { jobId, technicianId } });
  if (!assignment) throw forbidden('This job is not assigned to you');
  return assignment;
}

export async function myJobs(technicianId, { from, to, status }) {
  const range = dateRange(from, to);
  return prisma.job.findMany({
    where: {
      deletedAt: null,
      assignments: { some: { technicianId } },
      ...(status ? { status } : {}),
      ...(range ? { scheduledStart: range } : {}),
    },
    include: INCLUDE,
    orderBy: [{ scheduledStart: 'asc' }, { priority: 'desc' }],
  });
}

export async function myJobsToday(technicianId) {
  return prisma.job.findMany({
    where: {
      deletedAt: null,
      assignments: { some: { technicianId } },
      status: { notIn: ['CANCELLED', 'VERIFIED'] },
      OR: [
        { scheduledStart: { gte: startOfDay(), lte: endOfDay() } },
        { status: { in: ['IN_PROGRESS', 'ON_HOLD', 'EN_ROUTE'] } },
      ],
    },
    include: INCLUDE,
    orderBy: [{ scheduledStart: 'asc' }, { priority: 'desc' }],
  });
}
