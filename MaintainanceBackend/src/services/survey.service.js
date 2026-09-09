import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, dateRange } from '../utils/pagination.js';
import { lineAmount, toRupees } from '../utils/money.js';
import { nextNumber } from '../utils/numbering.js';
import { SURVEY_TRANSITIONS, LEAD_TRANSITIONS, JOB_TRANSITIONS, assertTransition, canTransition } from '../shared/stateMachines.js';
import * as jobs from './job.service.js';
import { createQuotation } from './quotation.service.js';
import { notify, notifyRoles } from './notify.service.js';

/**
 * A site survey is the report a surveyor fills in while standing on the site.
 * It carries QUANTITIES ONLY — no rate, no amount, no price snapshot. Price is
 * attached once, at review time, by priceSurvey() below.
 */

const INCLUDE = {
  job: {
    select: {
      id: true, number: true, type: true, status: true, title: true,
      scheduledStart: true, actualEnd: true,
      photos: { select: { id: true, mediaId: true, kind: true, caption: true } },
    },
  },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  site: { select: { id: true, label: true, address: true, area: true, lat: true, lng: true } },
  lead: { select: { id: true, name: true, status: true, message: true } },
  service: { select: { id: true, name: true, slug: true, priceUnit: true } },
  surveyor: { select: { id: true, employeeCode: true, user: { select: { id: true, name: true, phone: true } } } },
  submittedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  quotation: { select: { id: true, number: true, status: true, total: true } },
  readings: { orderBy: { sortOrder: 'asc' } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
      rateCardItem: { select: { id: true, code: true, name: true, unit: true } },
      service: { select: { id: true, name: true } },
    },
  },
};

/** The surveyor's own view: the same survey with every price-bearing relation dropped. */
const FIELD_INCLUDE = {
  job: { select: { id: true, number: true, type: true, status: true, title: true, scheduledStart: true } },
  customer: { select: { id: true, name: true, phone: true } },
  site: { select: { id: true, label: true, address: true, area: true, lat: true, lng: true } },
  service: { select: { id: true, name: true, priceUnit: true } },
  readings: { orderBy: { sortOrder: 'asc' } },
  items: { orderBy: { sortOrder: 'asc' } },
};

export async function listSurveys(query = {}) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query, { defaultSort: '-createdAt' });
  const created = dateRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.surveyorId ? { surveyorId: query.surveyorId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { problemSummary: { contains: q, mode: 'insensitive' } },
            { diagnosis: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.siteSurvey.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        surveyor: { select: { id: true, user: { select: { name: true } } } },
        job: { select: { id: true, number: true, scheduledStart: true } },
        quotation: { select: { id: true, number: true, status: true } },
        _count: { select: { items: true, readings: true } },
      },
    }),
    prisma.siteSurvey.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getSurvey(id, { field = false } = {}) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { id, deletedAt: null },
    include: field ? FIELD_INCLUDE : INCLUDE,
  });
  if (!survey) throw notFound('Survey');
  return survey;
}

export async function mySurveys(technicianId, { status } = {}) {
  return prisma.siteSurvey.findMany({
    where: { surveyorId: technicianId, deletedAt: null, ...(status ? { status } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: FIELD_INCLUDE,
  });
}

export async function assertOwnSurvey(surveyId, technicianId) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { id: surveyId, deletedAt: null },
    select: { id: true, surveyorId: true },
  });
  if (!survey) throw notFound('Survey');
  if (survey.surveyorId !== technicianId) throw forbidden('This survey is assigned to another surveyor');
  return survey;
}

/**
 * Creates the survey for an inspection job, or returns the one that already exists.
 * `jobId @unique` makes this idempotent, which matters because an offline device may
 * fire it twice — a repeat must never be a 409.
 *
 * @param {string} jobId
 * @param {{ surveyorId?: string }} input
 * @param {string} [userId]
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 * @returns {Promise<{ survey: object, created: boolean }>}
 */
export async function createFromJob(jobId, input = {}, userId, client = prisma) {
  const existing = await client.siteSurvey.findUnique({ where: { jobId } });
  if (existing) return { survey: existing, created: false };

  const job = await client.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      lead: { select: { id: true, serviceId: true, message: true } },
      assignments: { where: { isLead: true }, select: { technicianId: true } },
    },
  });
  if (!job) throw notFound('Job');
  // Keeps "the visit is an INSPECTION job" true in code rather than by convention.
  if (job.type !== 'INSPECTION') {
    throw unprocessable(`A survey belongs to an INSPECTION job, but ${job.number} is a ${job.type} job`);
  }

  const surveyorId = input.surveyorId ?? job.assignments[0]?.technicianId ?? null;
  const run = async (tx) => {
    const number = await nextNumber(tx, 'SRV');
    return tx.siteSurvey.create({
      data: {
        number,
        jobId,
        leadId: job.leadId,
        customerId: job.customerId,
        siteId: job.siteId,
        serviceId: job.lead?.serviceId ?? null,
        surveyorId,
        urgency: job.priority,
        problemSummary: job.lead?.message ?? job.description ?? null,
      },
    });
  };

  const survey = client === prisma ? await prisma.$transaction(run) : await run(client);
  return { survey, created: true };
}

/**
 * Replaces the survey's findings, readings and quantity lines in one go.
 *
 * Full replace rather than incremental edits is deliberate: it is what makes an
 * offline replay idempotent, since applying the same draft twice lands on the
 * same state. Money fields are unreachable — the zod schema is `.strict()` and
 * nothing below writes a rate.
 */
export async function saveDraft(id, input, { userId } = {}) {
  const survey = await prisma.siteSurvey.findFirst({ where: { id, deletedAt: null } });
  if (!survey) throw notFound('Survey');
  if (!['DRAFT', 'RETURNED'].includes(survey.status)) {
    throw unprocessable(
      `This survey is ${survey.status.toLowerCase().replace('_', ' ')} and can no longer be edited in the field.`,
    );
  }

  const { readings, items, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    if (readings) {
      await tx.surveyReading.deleteMany({ where: { surveyId: id } });
      if (readings.length) {
        await tx.surveyReading.createMany({
          data: readings.map((r, i) => ({ ...r, surveyId: id, sortOrder: r.sortOrder ?? i })),
        });
      }
    }
    if (items) {
      await tx.surveyItem.deleteMany({ where: { surveyId: id } });
      if (items.length) {
        await tx.surveyItem.createMany({
          data: items.map((it, i) => ({ ...it, surveyId: id, sortOrder: it.sortOrder ?? i })),
        });
      }
    }
    return tx.siteSurvey.update({
      where: { id },
      data: {
        ...fields,
        // A returned survey being edited is back in the surveyor's hands.
        ...(survey.status === 'RETURNED' ? { status: 'DRAFT', returnedReason: null } : {}),
        ...(userId ? { submittedById: survey.submittedById ?? undefined } : {}),
      },
      include: FIELD_INCLUDE,
    });
  });
}

/**
 * Walks an inspection job to IN_PROGRESS so the survey submission can close it.
 * The realistic starting points are ASSIGNED, SCHEDULED, EN_ROUTE and ON_HOLD;
 * anything else is a job that was never dispatched, and says so.
 */
async function driveJobToInProgress(job, userId) {
  if (['IN_PROGRESS', 'COMPLETED', 'VERIFIED'].includes(job.status)) return job.status;
  if (canTransition(JOB_TRANSITIONS, job.status, 'IN_PROGRESS')) {
    await jobs.changeStatus(job.id, { status: 'IN_PROGRESS' }, userId);
    return 'IN_PROGRESS';
  }
  if (canTransition(JOB_TRANSITIONS, job.status, 'EN_ROUTE')) {
    await jobs.changeStatus(job.id, { status: 'EN_ROUTE' }, userId);
    await jobs.changeStatus(job.id, { status: 'IN_PROGRESS' }, userId);
    return 'IN_PROGRESS';
  }
  throw unprocessable(
    `Visit ${job.number} is still ${job.status.toLowerCase()}. Schedule and start it before submitting the survey.`,
  );
}

/** DRAFT|RETURNED -> SUBMITTED. Also closes the inspection visit it belongs to. */
export async function submitSurvey(id, input = {}, actor = {}) {
  const { note, ...draft } = input;
  if (Object.keys(draft).length) await saveDraft(id, draft, actor);

  const survey = await prisma.siteSurvey.findFirst({
    where: { id, deletedAt: null },
    include: { items: true, job: { select: { id: true, number: true, status: true, type: true } } },
  });
  if (!survey) throw notFound('Survey');
  // An offline device may replay this. canTransition treats same -> same as legal,
  // so without an early return the visit would be completed a second time and the
  // office notified again. Return what is already there instead.
  if (survey.status !== 'DRAFT' && survey.status !== 'RETURNED') {
    assertTransition(SURVEY_TRANSITIONS, survey.status, 'SUBMITTED', 'survey');
    return getSurvey(id);
  }
  if (!survey.items.length) {
    throw unprocessable('Add at least one material or labour line before submitting the survey');
  }

  await driveJobToInProgress(survey.job, actor.userId);
  await jobs.completeJob(survey.job.id, { note: note ?? 'Site survey submitted' }, actor.userId);

  const updated = await prisma.siteSurvey.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: actor.userId ?? null },
    include: INCLUDE,
  });

  await notifyRoles(['ADMIN', 'SALES'], {
    type: 'survey_submitted',
    title: `Survey ${updated.number} ready to price`,
    body: `${updated.customer?.name ?? 'Customer'} · ${updated.items.length} line(s)`
      + `${updated.service ? ` · ${updated.service.name}` : ''}`,
    link: `/admin/surveys/${id}`,
  });

  return updated;
}

/** IN_REVIEW keeps it with the office; RETURNED hands it back to the surveyor. */
export async function reviewSurvey(id, { status, note }, userId) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { id, deletedAt: null },
    include: { surveyor: { select: { user: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!survey) throw notFound('Survey');
  assertTransition(SURVEY_TRANSITIONS, survey.status, status, 'survey');

  const updated = await prisma.siteSurvey.update({
    where: { id },
    data: {
      status,
      reviewNote: note ?? null,
      reviewedAt: new Date(),
      reviewedById: userId ?? null,
      ...(status === 'RETURNED' ? { returnedReason: note ?? null } : {}),
    },
    include: INCLUDE,
  });

  if (status === 'RETURNED' && survey.surveyor?.user) {
    const { id: surveyorUserId, phone } = survey.surveyor.user;
    await prisma.notification.create({
      data: {
        userId: surveyorUserId,
        type: 'survey_returned',
        title: `Survey ${updated.number} needs more detail`,
        body: note ?? null,
        link: `/tech/surveys/${id}`,
      },
    });
    // They are in the field, not at a desk.
    if (phone) {
      await notify({
        templateKey: 'survey_returned',
        channel: 'sms',
        to: phone,
        vars: { number: updated.number, note: note ?? '', appName: env.appName },
        related: { model: 'SiteSurvey', id },
        fallbackBody: 'Survey {{number}} was sent back: {{note}} - {{appName}}',
      });
    }
  }

  return updated;
}

/** Rounds an effective quantity to 3dp. Quantity rounding happens once, here. */
const effectiveQty = (qty, wastagePct) =>
  Math.round(Number(qty || 0) * (1 + Number(wastagePct || 0) / 100) * 1000) / 1000;

/**
 * Prices a survey's quantities against today's catalogue. Read-only: nothing is
 * written, and the survey never stores a rate.
 *
 * Anything unpriceable — a soft-deleted material, a service that is "priced on
 * inspection" — comes back in `missing[]` with a reason rather than being priced
 * at zero, so the reviewer sees the gap instead of inheriting it.
 *
 * @returns {Promise<{ lines: object[], subtotal: number, missing: object[] }>} paisa
 */
export async function priceSurvey(id) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { id, deletedAt: null },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          material: true,
          rateCardItem: true,
          service: { select: { id: true, name: true, priceFrom: true, priceUnit: true } },
        },
      },
    },
  });
  if (!survey) throw notFound('Survey');

  const lines = [];
  const missing = [];

  survey.items.forEach((item, index) => {
    const qty = effectiveQty(item.qty, item.wastagePct);
    let ratePaisa = null;
    let source = null;
    let reason = null;

    switch (item.kind) {
      case 'LABOUR':
      case 'SERVICE': {
        const card = item.rateCardItem;
        if (card && card.isActive && !card.deletedAt) {
          ratePaisa = card.rate;
          source = `rate-card:${card.code}`;
        } else if (item.kind === 'SERVICE' && item.service) {
          if (item.service.priceFrom == null) {
            reason = `${item.service.name} is priced on inspection — set a rate by hand`;
          } else {
            ratePaisa = item.service.priceFrom;
            source = `service:${item.service.id}`;
          }
        } else {
          reason = card ? 'The rate-card item is no longer active' : 'No rate-card item linked';
        }
        break;
      }
      case 'MATERIAL': {
        const material = item.material;
        if (material && material.isActive && !material.deletedAt) {
          ratePaisa = material.sellRate;
          source = `material:${material.code}`;
        } else {
          reason = material ? 'The material is no longer active' : 'No material linked';
        }
        break;
      }
      default:
        reason = 'Priced by hand';
    }

    if (ratePaisa == null) {
      missing.push({ surveyItemId: item.id, description: item.description, reason: reason ?? 'No rate found' });
    }

    lines.push({
      surveyItemId: item.id,
      kind: item.kind,
      description: item.description,
      unit: item.unit,
      qty,
      rawQty: item.qty,
      wastagePct: item.wastagePct,
      isOptional: item.isOptional,
      note: item.note,
      rateCardItemId: item.rateCardItemId ?? null,
      ratePaisa,
      amountPaisa: ratePaisa == null ? null : lineAmount(qty, ratePaisa),
      source,
      sortOrder: item.sortOrder ?? index,
    });
  });

  const subtotal = lines.reduce((total, l) => total + (l.amountPaisa ?? 0), 0);
  return { surveyId: id, lines, subtotal, missing };
}

/** paisa -> the rupee wire format createQuotation() already speaks. */
const toQuotationLine = (line, i) => ({
  rateCardItemId: line.rateCardItemId ?? null,
  description: line.description,
  unit: line.unit ?? undefined,
  qty: line.qty,
  rate: toRupees(line.ratePaisa ?? 0),
  sortOrder: line.sortOrder ?? i,
});

/**
 * Turns a reviewed survey into a priced DRAFT quotation.
 *
 * Rates in `input.items` are RUPEES — the wire format every quotation endpoint
 * uses. Totals, discount and VAT are computed by quotation.service.createQuotation;
 * nothing here adds up money, so there is only ever one VAT implementation.
 *
 * @param {string} id
 * @param {object} input
 * @param {string} userId
 * @returns {Promise<{ survey: object, quotation: object }>}
 */
export async function buildQuotationFromSurvey(id, input = {}, userId) {
  const survey = await prisma.siteSurvey.findFirst({ where: { id, deletedAt: null } });
  if (!survey) throw notFound('Survey');
  if (survey.quotationId) throw conflict('This survey has already been quoted');
  assertTransition(SURVEY_TRANSITIONS, survey.status, 'QUOTED', 'survey');

  const { items: overrides, includeOptional = false, ...quotationInput } = input;

  let items = overrides;
  if (!items) {
    const priced = await priceSurvey(id);
    const usable = priced.lines
      .filter((l) => includeOptional || !l.isOptional)
      .filter((l) => l.ratePaisa != null);
    if (!usable.length) {
      throw unprocessable(
        priced.lines.length
          ? 'None of the survey lines could be priced automatically. Set the rates by hand and try again.'
          : 'This survey has no lines to price',
        priced.missing,
      );
    }
    items = usable.map(toQuotationLine);
  }

  const quotation = await createQuotation(
    {
      ...quotationInput,
      customerId: survey.customerId,
      siteId: survey.siteId ?? undefined,
      leadId: survey.leadId ?? undefined,
      items,
    },
    userId,
  );

  // Compare-and-swap: two reviewers pressing "Build quotation" at once must not
  // produce two quotations. The guard lives in the where clause, so the loser
  // claims nothing and cleans up the draft it just made.
  const claimed = await prisma.siteSurvey.updateMany({
    where: { id, quotationId: null, status: { in: ['SUBMITTED', 'IN_REVIEW'] } },
    data: {
      status: 'QUOTED',
      quotationId: quotation.id,
      reviewedAt: new Date(),
      reviewedById: userId ?? null,
    },
  });

  if (claimed.count === 0) {
    await prisma.quotation.update({ where: { id: quotation.id }, data: { deletedAt: new Date() } });
    throw conflict('Someone else quoted this survey a moment ago. Reload to see it.');
  }

  if (survey.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: survey.leadId }, select: { status: true } });
    if (lead && canTransition(LEAD_TRANSITIONS, lead.status, 'QUOTED')) {
      await prisma.lead.update({ where: { id: survey.leadId }, data: { status: 'QUOTED' } });
    }
    await prisma.leadActivity.create({
      data: {
        leadId: survey.leadId,
        userId: userId ?? null,
        type: 'note',
        summary: `Quotation ${quotation.number} built from survey ${survey.number}`,
      },
    });
  }

  return { survey: await getSurvey(id), quotation };
}

export async function deleteSurvey(id) {
  const survey = await prisma.siteSurvey.findFirst({ where: { id, deletedAt: null } });
  if (!survey) throw notFound('Survey');
  if (survey.status !== 'DRAFT') {
    throw unprocessable('Only a draft survey can be deleted. Cancel it instead.');
  }
  await prisma.siteSurvey.update({ where: { id }, data: { deletedAt: new Date() } });
}
