import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound, badRequest, forbidden, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr, dateRange } from '../utils/pagination.js';
import { nextNumber } from '../utils/numbering.js';
import { sum } from '../utils/money.js';
import { addDays, dayjs, kathmanduDayRange, local, startOfDay, endOfDay } from '../utils/dates.js';
import { JOB_TRANSITIONS, QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { publicToken } from '../utils/tokens.js';
import { markConverted } from './quotation.service.js';
import { issueToJob } from './material.service.js';
import { recordEvent } from './audit.service.js';
import { webUrl } from '../utils/links.js';
import { makeCrud } from './crud.service.js';

/** Job templates: a named checklist, optionally for one service. A registry resource. */
export const jobTemplates = makeCrud({
  model: 'jobTemplate', label: 'Job template', searchFields: ['name', 'description'], sortable: false, defaultSort: 'name',
  include: { service: { select: { id: true, name: true } } },
  filter: (q) => (q.serviceId ? { serviceId: q.serviceId } : {}),
});

const INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true, preferredLocale: true } },
  site: { select: { id: true, label: true, address: true, area: true, lat: true, lng: true, accessNotes: true } },
  quotation: { select: { id: true, number: true, total: true, status: true } },
  assignments: {
    include: { technician: { include: { user: { select: { id: true, name: true, phone: true } } } } },
  },
  tasks: { orderBy: { sortOrder: 'asc' } },
};

/** Finished, billable work that no invoice has taken yet (`invoiced=false`), or the opposite. */
function invoicedWhere(invoiced) {
  if (invoiced === undefined) return {};
  return invoiced
    ? { invoicedAt: { not: null } }
    : { invoicedAt: null, isBillable: true, status: { in: ['COMPLETED', 'VERIFIED'] } };
}

export async function listJobs(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-createdAt' });
  const scheduled = kathmanduDayRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.technicianId ? { assignments: { some: { technicianId: query.technicianId } } } : {}),
    ...(query.unassigned ? { assignments: { none: {} } } : {}),
    ...(scheduled ? { scheduledStart: scheduled } : {}),
    ...invoicedWhere(query.invoiced),
    ...(q ? { OR: [...searchOr(q, ['number', 'title', 'description']), { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  // A status preset and the not-invoiced filter both name statuses; the preset wins.
  if (query.status) where.status = query.status;
  const [items, total] = await Promise.all([
    prisma.job.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip, take, include: INCLUDE }),
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
      parentJob: { select: { id: true, number: true, type: true, status: true } },
      survey: { select: { id: true, number: true, status: true } },
      project: { select: { id: true, title: true, isActive: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!job) throw notFound('Job');
  return job;
}

/** A row in the job's own status timeline (JobStatusEvent), shown on the job sheet. */
async function recordStatusEvent(tx, { jobId, from, to, actorId, note, lat, lng }) {
  return tx.jobStatusEvent.create({
    data: { jobId, from: from ?? null, to, actorId: actorId ?? null, note: note ?? null, lat: lat ?? null, lng: lng ?? null },
  });
}

/**
 * @param {object} input
 * @param {string} [userId]
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]  the caller's transaction
 *   (lead convert). The job is then written inside it and the technicians are NOT
 *   notified — the caller runs announceAssignment() once its transaction commits.
 */
export async function createJob(input, userId, client = prisma) {
  const { technicianIds = [], leadTechnicianId, templateId, ...rest } = input;
  const inCallerTx = client !== prisma;

  const customer = await client.customer.findFirst({ where: { id: rest.customerId, deletedAt: null } });
  if (!customer) throw badRequest('That customer does not exist');
  if (rest.siteId) {
    const site = await client.customerSite.findFirst({ where: { id: rest.siteId, customerId: rest.customerId, deletedAt: null } });
    if (!site) throw badRequest('That site does not belong to this customer');
  }
  if (rest.quotationId) {
    const quotation = await client.quotation.findFirst({ where: { id: rest.quotationId, deletedAt: null } });
    if (!quotation) throw badRequest('That quotation does not exist');
    if (quotation.customerId !== rest.customerId) throw badRequest('That quotation belongs to another customer');
    // Only approved work becomes a job. Without this, a job pointing at a draft
    // marked it CONVERTED and the customer's approval step simply never happened.
    // CONVERTED → CONVERTED would pass assertTransition (a no-op move), so it is refused
    // by name: a quotation becomes work once.
    if (quotation.status === 'CONVERTED') {
      throw new AppError(422, 'INVALID_TRANSITION', 'This quotation has already been converted to a job');
    }
    assertTransition(QUOTATION_TRANSITIONS, quotation.status, 'CONVERTED', 'quotation');
  }

  let tasks = [];
  if (templateId) {
    const tpl = await client.jobTemplate.findFirst({ where: { id: templateId, deletedAt: null } });
    if (!tpl) throw badRequest('That job template does not exist');
    tasks = (tpl.tasks ?? []).map((t, i) => ({ title: t.title, note: t.description ?? null, sortOrder: i }));
  }

  const status = technicianIds.length ? 'ASSIGNED' : rest.scheduledStart ? 'SCHEDULED' : 'DRAFT';

  const run = async (tx) => {
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
    await recordStatusEvent(tx, { jobId: created.id, from: null, to: status, actorId: userId, note: 'Job created' });
    await recordEvent('job.created', {
      model: 'Job',
      recordId: created.id,
      after: {
        number, type: created.type, status, customerId: created.customerId,
        quotationId: created.quotationId, leadId: created.leadId, technicianIds,
      },
    }, tx);
    if (rest.quotationId) await markConverted(rest.quotationId, tx);
    return created;
  };

  if (inCallerTx) return run(client);
  const job = await prisma.$transaction(run);
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

/** Notifies each assigned technician in-app and by SMS. Call only after the job has committed. */
export async function announceAssignment(job, technicianIds) {
  const techs = await prisma.technician.findMany({
    where: { id: { in: technicianIds } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  for (const t of techs) {
    await prisma.notification.create({
      data: {
        userId: t.userId, type: 'job_assigned',
        title: `New job — ${job.number}`,
        body: `${job.title}${job.scheduledStart ? ` · ${local(job.scheduledStart, 'D MMM HH:mm')}` : ''}`,
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
          when: job.scheduledStart ? local(job.scheduledStart, 'D MMM YYYY HH:mm') : 'TBC',
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
    await recordStatusEvent(tx, { jobId: id, from: job.status, to: status, actorId: userId, note, lat, lng });
    await recordEvent('job.status_changed', {
      model: 'Job', recordId: id, before: { status: job.status }, after: { status }, ...(note ? { meta: { note } } : {}),
    }, tx);
    return row;
  });

  if (status === 'EN_ROUTE' && updated.customer?.phone) {
    await notify({
      templateKey: 'job_en_route', channel: 'sms', to: updated.customer.phone, locale: updated.customer.preferredLocale,
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

    await recordStatusEvent(tx, { jobId: id, from: job.status, to: 'COMPLETED', actorId: userId, note: input.note });
    await recordEvent('job.completed', {
      model: 'Job', recordId: id, before: { status: job.status }, after: { status: 'COMPLETED' },
      meta: { customerRating: input.customerRating ?? null },
    }, tx);

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
    await notify({
      templateKey: 'job_completed', channel: 'sms', to: updated.customer.phone, locale: updated.customer.preferredLocale,
      vars: {
        customerName: updated.customer.name, number: updated.number, appName: env.appName,
        warrantyDays, warrantyLink: warranty ? webUrl(`/warranty/${warranty.publicToken}`) : '',
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
      link: `/admin/jobs/${id}`,
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
    await recordStatusEvent(tx, { jobId: id, from: job.status, to: 'VERIFIED', actorId: userId });
    await recordEvent('job.verified', { model: 'Job', recordId: id, before: { status: job.status }, after: { status: 'VERIFIED' } }, tx);
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
    await recordStatusEvent(tx, { jobId: id, from: job.status, to: nextStatus, actorId: userId, note: note ?? 'Technicians assigned' });
    await recordEvent('job.assigned', {
      model: 'Job',
      recordId: id,
      before: { technicianIds: job.assignments.map((a) => a.technicianId), status: job.status },
      after: { technicianIds, status: nextStatus },
    }, tx);
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

  // Each line's cost is rounded once and the total is their sum, so the breakdown adds up to the paisa.
  const lineCost = (m) => Math.round(m.qty * (m.material.purchaseRate || m.rate));
  const materialCost = sum(job.materials.map(lineCost));
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
        qty: m.qty, rate: m.rate, amount: Math.round(m.qty * m.rate), cost: lineCost(m), isBillable: m.isBillable,
      })),
      labour: job.timeLogs.map((t) => ({
        technician: t.technician.user.name, startedAt: t.startedAt, minutes: t.minutes ?? 0,
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

/** The working day the board draws, in Kathmandu hours. */
export const DISPATCH_HOURS = { start: 8, end: 18 };

/** What a board card needs, and no more — the board loads a week of them. */
const CARD = {
  id: true, number: true, title: true, type: true, status: true, priority: true,
  scheduledStart: true, scheduledEnd: true, quotationId: true, createdAt: true,
  customer: { select: { id: true, name: true, phone: true } },
  site: { select: { id: true, area: true, address: true } },
  assignments: { select: { technicianId: true, isLead: true } },
};

const OPEN_FOR_DISPATCH = ['DRAFT', 'SCHEDULED'];
const unassignedWhere = { deletedAt: null, assignments: { none: {} }, status: { in: OPEN_FOR_DISPATCH } };

/** A Kathmandu calendar day, `YYYY-MM-DD`. */
const ktmDay = (date) => local(date, 'YYYY-MM-DD');

/**
 * Overlapping scheduled windows among one technician's jobs, and the days they are booked past
 * their daily capacity. The SPA runs the same rules before it commits a move
 * (`helpers/dispatchBoard.js#scheduleWarnings`); this is the server's copy for the board and for
 * `meta.warnings` on a schedule.
 *
 * @param {{ number: string, scheduledStart?: Date|string|null, scheduledEnd?: Date|string|null }[]} jobs
 * @param {number} dailyCapacity
 */
export function laneWarnings(jobs, dailyCapacity) {
  const conflicts = [];
  const timed = jobs.filter((j) => j.scheduledStart && j.scheduledEnd);
  for (let i = 0; i < timed.length; i += 1) {
    for (let k = i + 1; k < timed.length; k += 1) {
      const a = timed[i];
      const b = timed[k];
      if (new Date(a.scheduledStart) < new Date(b.scheduledEnd) && new Date(b.scheduledStart) < new Date(a.scheduledEnd)) {
        conflicts.push({ a: a.number, b: b.number, day: ktmDay(a.scheduledStart) });
      }
    }
  }
  const loadByDay = {};
  for (const j of jobs) {
    if (!j.scheduledStart) continue;
    const day = ktmDay(j.scheduledStart);
    loadByDay[day] = (loadByDay[day] ?? 0) + 1;
  }
  const overCapacityDays = Object.keys(loadByDay).filter((day) => loadByDay[day] > dailyCapacity).sort();
  return { conflicts, loadByDay, overCapacityDays };
}

/**
 * GET /admin/dispatch/board — technicians × the day, or the seven days from `date`. The unassigned queue is paged separately (`/dispatch/unassigned`); the board only
 * says how long it is.
 */
export async function dispatchBoard({ date, view = 'day', technicianId, role }) {
  const anchor = date ? dayjs.tz(date, env.business.timezone).toDate() : new Date();
  const dayCount = view === 'week' ? 7 : 1;
  const from = startOfDay(anchor);
  const to = endOfDay(addDays(from, dayCount - 1));
  const days = Array.from({ length: dayCount }, (_, i) => ktmDay(addDays(from, i)));

  const [technicians, jobs, unscheduledAssigned, unassignedCount] = await Promise.all([
    prisma.technician.findMany({
      where: {
        deletedAt: null,
        user: { isActive: true, deletedAt: null, ...(role ? { role } : {}) },
        ...(technicianId ? { id: technicianId } : {}),
      },
      include: { user: { select: { id: true, name: true, phone: true, role: true } } },
      orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
    }),
    prisma.job.findMany({
      where: { deletedAt: null, scheduledStart: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: CARD,
      orderBy: { scheduledStart: 'asc' },
    }),
    prisma.job.findMany({
      where: {
        deletedAt: null, scheduledStart: null, assignments: { some: {} },
        status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] },
      },
      select: CARD,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    prisma.job.count({ where: unassignedWhere }),
  ]);

  const lanes = technicians.map((t) => {
    const laneJobs = jobs.filter((j) => j.assignments.some((a) => a.technicianId === t.id));
    return {
      technician: {
        id: t.id, name: t.user.name, phone: t.user.phone, role: t.user.role, employeeCode: t.employeeCode,
        skills: t.skills ?? [], serviceAreas: t.serviceAreas ?? [], rating: t.rating,
        dailyCapacity: t.dailyCapacity, isAvailable: t.isAvailable,
      },
      jobs: laneJobs,
      ...laneWarnings(laneJobs, t.dailyCapacity),
    };
  });

  return {
    from, to, view, days, hours: DISPATCH_HOURS, lanes, unscheduledAssigned, unassignedCount,
  };
}

/** GET /admin/dispatch/unassigned — work nobody is on yet, most urgent first. Paginated. */
export async function listUnassigned(query = {}) {
  const { page, limit, skip, take, q } = parseListQuery(query, { defaultSort: 'createdAt' });
  const where = {
    ...unassignedWhere,
    ...(q ? { OR: [...searchOr(q, ['number', 'title']), { customer: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const sort = String(query.sort || 'priority');
  const dir = sort.startsWith('-') ? 'desc' : 'asc';
  const orderBy = sort.replace(/^-/, '') === 'createdAt'
    ? [{ createdAt: dir }, { id: 'asc' }]
    // Most urgent first: URGENT sorts last in the enum, so priority runs descending.
    : [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }];
  const [items, total] = await Promise.all([
    prisma.job.findMany({ where, select: CARD, orderBy, skip, take }),
    prisma.job.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * What would be wrong with these technicians doing a job in this window: overlaps with their
 * other jobs, and days over their capacity. Warnings, never a refusal — dispatch knows things the
 * schedule does not (a half-hour job, a technician who agreed to stay late).
 *
 * @returns {Promise<{ kind: 'conflict'|'capacity', technicianId: string, technician: string, day: string, with?: string, load?: number, capacity?: number }[]>}
 */
export async function scheduleWarnings({ jobId, number, scheduledStart, scheduledEnd, technicianIds }) {
  if (!technicianIds.length || !scheduledStart) return [];
  const from = startOfDay(scheduledStart);
  const to = endOfDay(scheduledEnd ?? scheduledStart);
  const technicians = await prisma.technician.findMany({
    where: { id: { in: technicianIds } },
    include: { user: { select: { name: true } } },
  });
  const others = await prisma.job.findMany({
    where: {
      id: { not: jobId }, deletedAt: null, status: { not: 'CANCELLED' },
      scheduledStart: { gte: from, lte: to },
      assignments: { some: { technicianId: { in: technicianIds } } },
    },
    select: { number: true, scheduledStart: true, scheduledEnd: true, assignments: { select: { technicianId: true } } },
  });
  const self = { number, scheduledStart, scheduledEnd };
  const warnings = [];
  for (const t of technicians) {
    const lane = others.filter((j) => j.assignments.some((a) => a.technicianId === t.id));
    const { conflicts, overCapacityDays, loadByDay } = laneWarnings([self, ...lane], t.dailyCapacity);
    for (const c of conflicts.filter((x) => x.a === number || x.b === number)) {
      warnings.push({ kind: 'conflict', technicianId: t.id, technician: t.user.name, day: c.day, with: c.a === number ? c.b : c.a });
    }
    for (const day of overCapacityDays) {
      warnings.push({ kind: 'capacity', technicianId: t.id, technician: t.user.name, day, load: loadByDay[day], capacity: t.dailyCapacity });
    }
  }
  return warnings;
}

/**
 * POST /admin/jobs/:id/schedule — puts a job on the calendar, and on people, in one step: the
 * dispatch board's drop and its Schedule dialog both land here.
 *
 * - Sets the window. `technicianIds`, when given, replaces the assignment (the first leads
 *   unless `leadTechnicianId` says otherwise); left out, the assignment stays.
 * - DRAFT and SCHEDULED move to ASSIGNED once someone is on the job, else to SCHEDULED; ON_HOLD
 *   returns to SCHEDULED. ASSIGNED keeps its status; only its window moves. Work under way
 *   (EN_ROUTE, IN_PROGRESS) or closed cannot be rescheduled.
 * - The customer gets a `job_scheduled` SMS in their language when the window changed
 *   (`notifyCustomer: false` skips it — a same-day shuffle the customer already agreed by phone).
 * - Newly assigned technicians are told, as on an assignment.
 *
 * @returns {Promise<{ job: object, warnings: object[] }>}
 */
export async function scheduleJob(id, input, userId) {
  const { scheduledStart, scheduledEnd, technicianIds, leadTechnicianId, note, notifyCustomer = true } = input;
  const job = await getJob(id);
  if (['EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'].includes(job.status)) {
    throw unprocessable(`A job that is ${job.status.toLowerCase().replace('_', ' ')} cannot be rescheduled`);
  }
  if (technicianIds) {
    const found = await prisma.technician.count({ where: { id: { in: technicianIds }, deletedAt: null } });
    if (found !== technicianIds.length) throw badRequest('One or more technicians do not exist');
    if (leadTechnicianId && !technicianIds.includes(leadTechnicianId)) {
      throw badRequest('The lead technician must be one of the technicians on the job', [{ path: ['leadTechnicianId'], message: 'Choose one of the technicians on the job' }]);
    }
  }

  const before = job.assignments.map((a) => a.technicianId);
  const after = technicianIds ?? before;
  const assigned = after.length > 0;
  // ON_HOLD may only return through SCHEDULED; the technicians stay on it and can set off from there.
  const nextStatus = job.status === 'ON_HOLD' ? 'SCHEDULED'
    : ['DRAFT', 'SCHEDULED'].includes(job.status) ? (assigned ? 'ASSIGNED' : 'SCHEDULED')
      : job.status;
  if (nextStatus !== job.status) assertTransition(JOB_TRANSITIONS, job.status, nextStatus, 'job');

  const sameInstant = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  const moved = !sameInstant(job.scheduledStart, scheduledStart) || !sameInstant(job.scheduledEnd, scheduledEnd);
  const added = after.filter((tid) => !before.includes(tid));
  const leadChanged = technicianIds && (leadTechnicianId ?? technicianIds[0]) !== job.assignments.find((a) => a.isLead)?.technicianId;

  const updated = await prisma.$transaction(async (tx) => {
    if (technicianIds && (added.length || before.length !== after.length || leadChanged)) {
      await tx.jobAssignment.deleteMany({ where: { jobId: id } });
      await tx.jobAssignment.createMany({
        data: technicianIds.map((tid) => ({
          jobId: id, technicianId: tid, isLead: tid === (leadTechnicianId ?? technicianIds[0]),
        })),
      });
    }
    const row = await tx.job.update({
      where: { id },
      data: { scheduledStart, scheduledEnd, status: nextStatus, ...(job.status === 'ON_HOLD' ? { holdReason: null } : {}) },
      include: INCLUDE,
    });
    const when = `${local(scheduledStart, 'D MMM YYYY HH:mm')}–${local(scheduledEnd, 'HH:mm')}`;
    await recordStatusEvent(tx, {
      jobId: id, from: job.status, to: nextStatus, actorId: userId,
      note: note ?? (job.scheduledStart ? `Rescheduled to ${when}` : `Scheduled for ${when}`),
    });
    await recordEvent('job.scheduled', {
      model: 'Job',
      recordId: id,
      before: { status: job.status, scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd, technicianIds: before },
      after: { status: nextStatus, scheduledStart, scheduledEnd, technicianIds: after },
    }, tx);
    return row;
  });

  if (added.length) await announceAssignment(updated, added);
  if (moved && notifyCustomer && updated.customer?.phone) {
    await notify({
      templateKey: 'job_scheduled', channel: 'sms', to: updated.customer.phone, locale: updated.customer.preferredLocale,
      vars: {
        customerName: updated.customer.name, number: updated.number, appName: env.appName,
        date: local(scheduledStart, 'D MMM YYYY'), time: `${local(scheduledStart, 'HH:mm')}–${local(scheduledEnd, 'HH:mm')}`,
      },
      related: { model: 'Job', id },
      fallbackBody: 'Hi {{customerName}}, job {{number}} is booked for {{date}}, {{time}}. We will call before we come. - {{appName}}',
    });
  }

  const warnings = await scheduleWarnings({
    jobId: id, number: updated.number, scheduledStart, scheduledEnd, technicianIds: after,
  });
  return { job: updated, warnings };
}

// ── technician-scoped access

/** Resolves the Technician row for a logged-in user, rejecting non-technicians. */
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
