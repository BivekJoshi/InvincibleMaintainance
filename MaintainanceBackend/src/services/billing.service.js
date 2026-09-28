import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../utils/AppError.js';
import { addDays } from '../utils/dates.js';
import { finalBillDocument, lineAmount, paymentSchedule, proRata, sum } from '../utils/money.js';
import { measurementQty } from '../utils/quantity.js';
import { getSetting } from './settings.service.js';
import { recordEvent } from './audit.service.js';
import { createStageInvoice, getInvoice } from './invoice.service.js';
import { getJobDetail } from './job.service.js';
import { createLead } from './lead.service.js';

/**
 * Close-out (Phase L8): running bills per payment stage, the final measurement, the FINAL bill by the contract
 * type (L-D2) and the AMC offer at handover.
 *
 * The FINAL bill of a BOQ job:
 *   LUMP_SUM  — every job line at its quoted qty (a provisional line at its measured qty; omissions as quoted),
 *               less each source document's own discount (the quotation's and each variation's).
 *   ITEM_RATE — every line at its measured qty (omissions as quoted) × its rate, each document's discount
 *               scaled to what was measured of its own lines (money.js#proRata); the measurement must be closed.
 * Both then deduct every earlier ADVANCE and RUNNING bill that is not void, as DEDUCTION lines, with the VAT
 * that is left (money.js#finalBillDocument on finalBillTotals) — so the stage bills and the final add up to the
 * contract to the paisa. A final that would come out below what was billed is refused (credit notes are deferred).
 */

const JOB_FOR_BILL = {
  lines: { orderBy: { sortOrder: 'asc' } },
  quotation: { include: { stages: { orderBy: { sortOrder: 'asc' } } } },
};

/** Which lines a contract measures: ITEM_RATE all but omissions; LUMP_SUM its provisional lines. */
const needsMeasure = (contractType, line) => line.quotedQty > 0 && (contractType === 'ITEM_RATE' || line.isProvisional);

const unmeasured = (contractType, lines) => lines.filter((l) => needsMeasure(contractType, l) && l.measuredQty == null)
  .map((l) => ({ lineId: l.id, number: l.number, description: l.description }));

/** The job's stage bills that the final deducts: ADVANCE and RUNNING, not void. */
const stageBillsOf = (jobId) => prisma.invoice.findMany({
  where: { jobId, kind: { in: ['ADVANCE', 'RUNNING'] }, status: { not: 'VOID' }, deletedAt: null },
  orderBy: { issuedAt: 'asc' },
});

const finalOf = (jobId) => prisma.invoice.findFirst({ where: { jobId, kind: 'FINAL', status: { not: 'VOID' }, deletedAt: null }, select: { id: true, number: true } });

/**
 * The final bill of a job, worked out without writing anything: `{ boq: false }` for a job with no BOQ lines
 * (Phase I's rules bill it), else the lines, the deductions, the document from money.js and what blocks it.
 */
export async function finalBillPlan(jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, include: JOB_FOR_BILL });
  if (!job) throw notFound('Job');
  if (!job.lines.length || !job.quotation) return { boq: false, job };
  const q = job.quotation;
  const contractType = q.contractType ?? 'LUMP_SUM';

  // The source document of each line — the quotation or a variation — for its discount.
  const items = await prisma.quotationItem.findMany({
    where: { id: { in: job.lines.map((l) => l.quotationItemId).filter(Boolean) } }, select: { id: true, quotationId: true },
  });
  const docOfItem = new Map(items.map((i) => [i.id, i.quotationId]));
  const docs = await prisma.quotation.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.quotationId))] } }, select: { id: true, number: true, discount: true },
  });

  const lines = job.lines.map((l) => {
    const qty = needsMeasure(contractType, l) ? (l.measuredQty ?? l.quotedQty) : l.quotedQty;
    return {
      lineId: l.id, number: l.number, source: l.source, docId: docOfItem.get(l.quotationItemId) ?? q.id,
      // "A.1 Internal plaster" — a sectioned BOQ's number reads on the bill; a plain "1" does not.
      description: l.number && /[A-Z]/.test(l.number) ? `${l.number} ${l.description}` : l.description, unit: l.unit, qty, rate: l.rate,
      amount: lineAmount(qty, l.rate), quotedAmount: lineAmount(l.quotedQty, l.rate),
    };
  });
  const discount = sum(docs.map((d) => {
    if (contractType === 'LUMP_SUM') return d.discount;
    const own = lines.filter((l) => l.docId === d.id);
    return proRata(d.discount, sum(own.map((l) => l.amount)), sum(own.map((l) => l.quotedAmount)));
  }));

  const earlier = await stageBillsOf(jobId);
  const deductions = earlier.map((b) => ({
    invoiceId: b.id, number: b.number, kind: b.kind,
    description: `Less: ${b.kind === 'ADVANCE' ? 'advance' : 'running bill'} ${b.number}`,
    taxable: b.subtotal - b.discount, vat: b.vatAmount, total: b.total,
  }));
  const document = finalBillDocument(
    lines.map(({ description, unit, qty, rate }) => ({ description, unit, qty, rate })),
    deductions.map(({ description, taxable, vat }) => ({ description, taxable, vat })),
    { discount, vatApplied: q.vatApplied, vatRate: q.vatRate },
  );

  const blocking = [];
  const missing = unmeasured(contractType, job.lines);
  if (missing.length || (contractType === 'ITEM_RATE' && !job.measurementClosedAt)) {
    blocking.push({
      code: 'MEASUREMENT_INCOMPLETE',
      message: contractType === 'ITEM_RATE'
        ? 'An item-rate job bills what was measured: measure every line and close the measurement first.'
        : 'A provisional line is billed at its measured quantity: measure it first.',
      details: missing,
    });
  }
  const existing = await finalOf(jobId);
  if (existing) blocking.push({ code: 'FINAL_ALREADY_BILLED', message: `The final bill is ${existing.number}.` });
  if (document.total < 0) {
    blocking.push({ code: 'FINAL_BELOW_BILLED', message: 'The stage bills already exceed the final contract; a credit note is needed (not yet supported).' });
  }

  const billedTaxable = sum(deductions.map((d) => d.taxable));
  const billedVat = sum(deductions.map((d) => d.vat));
  return {
    boq: true, job, quotation: q, contractType,
    measurementRequired: contractType === 'ITEM_RATE' || job.lines.some((l) => needsMeasure(contractType, l)),
    measurementClosed: Boolean(job.measurementClosedAt),
    lines, deductions, document, blocking,
    totals: {
      contract: {
        subtotal: document.subtotal + billedTaxable, discount: document.discount,
        taxable: document.subtotal + billedTaxable - document.discount,
        vatAmount: document.vatAmount + billedVat, total: document.total + billedTaxable + billedVat,
      },
      billed: { taxable: billedTaxable, vat: billedVat, total: billedTaxable + billedVat },
      due: { taxable: document.subtotal - document.discount, vat: document.vatAmount, total: document.total },
    },
  };
}

/** GET /admin/jobs/:id/final-bill — the preview, exactly what POST …/from-job would write. */
export async function finalBillPreview(jobId) {
  const plan = await finalBillPlan(jobId);
  if (!plan.boq) return { boq: false };
  return {
    boq: true, contractType: plan.contractType, measurementRequired: plan.measurementRequired, measurementClosed: plan.measurementClosed,
    lines: plan.lines.map(({ docId: _d, quotedAmount: _q, ...l }) => l),
    deductions: plan.deductions, totals: plan.totals, blocking: plan.blocking,
  };
}

/**
 * POST /admin/jobs/:id/invoices/stage — the RUNNING bill for a MILESTONE stage of the job's quotation: the stage's
 * amount from the payment schedule, a DRAFT with locked lines. 404 STAGE_NOT_FOUND (not this job's), 409
 * STAGE_BILLED (a live invoice has it), 422 STAGE_NOT_MILESTONE, 422 FINAL_ALREADY_BILLED.
 */
export async function raiseStageBill(jobId, paymentStageId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, include: JOB_FOR_BILL });
  if (!job) throw notFound('Job');
  const q = job.quotation;
  const stage = q?.stages.find((st) => st.id === paymentStageId);
  if (!stage) throw new AppError(404, 'STAGE_NOT_FOUND', 'That payment stage is not on this job\'s quotation');
  const billed = await prisma.invoice.findFirst({ where: { paymentStageId }, select: { number: true } });
  if (billed) throw new AppError(409, 'STAGE_BILLED', `"${stage.label}" is already billed on ${billed.number}`);
  if (stage.trigger !== 'MILESTONE') {
    throw new AppError(422, 'STAGE_NOT_MILESTONE', 'Only a milestone stage is a running bill — the advance comes at acceptance, the rest with the final bill.');
  }
  const final = await finalOf(jobId);
  if (final) throw new AppError(422, 'FINAL_ALREADY_BILLED', `The final bill ${final.number} already closed this job's billing`);

  const scheduled = paymentSchedule(q, q.stages).find((st) => st.id === stage.id);
  const dueDays = Number(await getSetting('finance.paymentTermDays', 15));
  try {
    const invoice = await prisma.$transaction((tx) => createStageInvoice(tx, {
      kind: 'RUNNING', quotation: q, stage: scheduled, jobId, dueDate: addDays(new Date(), dueDays), status: 'DRAFT',
    }));
    return getInvoice(invoice.id);
  } catch (err) {
    // Two accountants at once: the unique paymentStageId lets one through.
    if (err.code === 'P2002') throw new AppError(409, 'STAGE_BILLED', `"${stage.label}" is already billed`);
    throw err;
  }
}

/** A line as the measure screens show it — quantities only (the field's never carries a rate). */
const measureShape = (l) => ({
  id: l.id, number: l.number, section: l.section, source: l.source, description: l.description, unit: l.unit,
  quotedQty: l.quotedQty, isProvisional: l.isProvisional, measurements: l.measurements ?? [], measuredQty: l.measuredQty,
});

/**
 * PUT …/jobs/:id/lines/:lineId/measure (admin jobs:write, and /tech for people on the job) — the line's measurement
 * rows; measuredQty is the server's (quantity.js#measurementQty). 422 MEASUREMENT_CLOSED once closed; 422
 * LINE_NOT_MEASURED for an omission (it keeps its quoted quantity).
 */
export async function measureLine(jobId, lineId, { measurements }) {
  const line = await prisma.jobLine.findFirst({ where: { id: lineId, jobId }, include: { job: { select: { measurementClosedAt: true, deletedAt: true } } } });
  if (!line || line.job.deletedAt) throw notFound('Job line');
  if (line.job.measurementClosedAt) throw new AppError(422, 'MEASUREMENT_CLOSED', 'The measurement is closed. Reopen it to change a quantity.');
  if (line.quotedQty < 0) throw new AppError(422, 'LINE_NOT_MEASURED', 'An omission keeps its quoted quantity: it is not measured.');
  const measuredQty = measurementQty(measurements);
  if (measuredQty < 0) throw new AppError(422, 'NEGATIVE_LINE', 'The measurements come to less than zero — check the deductions.');
  return measureShape(await prisma.jobLine.update({ where: { id: lineId }, data: { measurements, measuredQty } }));
}

/**
 * POST /admin/jobs/:id/measurement/close — every line the contract measures has a quantity (else 422
 * MEASUREMENT_INCOMPLETE with them), then closed, guarded, with who and when (`job.measurement_closed`).
 */
export async function closeMeasurement(jobId, userId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, include: JOB_FOR_BILL });
  if (!job) throw notFound('Job');
  if (!job.lines.length) throw new AppError(422, 'MEASUREMENT_INCOMPLETE', 'This job has no BOQ lines to measure');
  const contractType = job.quotation?.contractType ?? 'LUMP_SUM';
  const missing = unmeasured(contractType, job.lines);
  if (missing.length) throw new AppError(422, 'MEASUREMENT_INCOMPLETE', `${missing.length} line(s) are not measured yet`, missing);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.job.updateMany({ where: { id: jobId, measurementClosedAt: null }, data: { measurementClosedAt: new Date(), measurementClosedById: userId ?? null } });
    if (!count) throw new AppError(422, 'MEASUREMENT_CLOSED', 'The measurement is already closed');
    await recordEvent('job.measurement_closed', { model: 'Job', recordId: jobId, meta: { lines: job.lines.length, contractType } }, tx);
  });
  return getJobDetail(jobId);
}

/** POST /admin/jobs/:id/measurement/reopen — until the final bill is raised (422 FINAL_ALREADY_BILLED). */
export async function reopenMeasurement(jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { id: true, measurementClosedAt: true } });
  if (!job) throw notFound('Job');
  const final = await finalOf(jobId);
  if (final) throw new AppError(422, 'FINAL_ALREADY_BILLED', `The final bill ${final.number} was raised from this measurement; void it first`);
  if (!job.measurementClosedAt) throw new AppError(422, 'MEASUREMENT_OPEN', 'The measurement is open');
  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data: { measurementClosedAt: null, measurementClosedById: null } });
    await recordEvent('job.measurement_reopened', { model: 'Job', recordId: jobId, before: { measurementClosedAt: job.measurementClosedAt } }, tx);
  });
  return getJobDetail(jobId);
}

/**
 * POST /admin/jobs/:id/offer-amc — at handover, a lead for sales to offer a yearly maintenance contract: source
 * `amc_offer`, the customer and the site's address, owned by whoever sold the job (else the round-robin). An open
 * AMC-offer lead for the customer is returned instead of a second one.
 * @returns {Promise<{ lead: object, created: boolean }>}
 */
export async function offerAmc(jobId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      customer: true, site: { select: { address: true, area: true } },
      lead: { select: { assignedToId: true } }, quotation: { select: { lead: { select: { assignedToId: true } } } },
    },
  });
  if (!job) throw notFound('Job');
  const open = await prisma.lead.findFirst({
    where: { customerId: job.customerId, source: 'amc_offer', status: { notIn: ['WON', 'LOST'] }, deletedAt: null },
    include: { assignedTo: { select: { id: true, name: true } } },
  });
  if (open) return { lead: open, created: false };
  const lead = await createLead({
    name: job.customer.name, phone: job.customer.phone, email: job.customer.email ?? undefined, customerId: job.customerId,
    address: job.site?.address ?? undefined, area: job.site?.area ?? undefined, source: 'amc_offer',
    preferredLocale: job.customer.preferredLocale ?? 'en',
    message: `AMC offer after job ${job.number} (${job.title}) — offer a yearly maintenance contract.`,
    ...(job.lead?.assignedToId ?? job.quotation?.lead?.assignedToId ? { assignedToId: job.lead?.assignedToId ?? job.quotation.lead.assignedToId } : {}),
  // No actor: the lead is sales' — the seller's, else the round-robin — never the dispatcher's who offered it.
  });
  return { lead, created: true };
}
