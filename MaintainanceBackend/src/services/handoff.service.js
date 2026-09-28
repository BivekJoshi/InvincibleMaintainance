import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { addDays, local } from '../utils/dates.js';
import { formatNpr, outstanding, paymentSchedule } from '../utils/money.js';
import { shortfall, sumQty } from '../utils/quantity.js';
import { webUrl } from '../utils/links.js';
import { QUOTATION_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { getSetting } from './settings.service.js';
import { boqNumbers, takeoffFor } from './boq.service.js';
import { createStageInvoice } from './invoice.service.js';
import { advanceState, announceAssignment, createJob, getJob, getJobDetail } from './job.service.js';
import { stockBalances } from './material.service.js';
import { notify } from './notify.service.js';
import { findQuotation, lineageIds, winLeadOnAcceptance } from './quotation.service.js';

/**
 * Won → hand-off (Phase L6). An accepted quotation hands over everything the work needs, in the accept
 * transaction (`acceptQuotation`) or a staff convert (`convertQuotationToJob`):
 *
 *   1. the approve compare-and-swap (SENT → APPROVED; the caller's)       — a double tap claims nothing
 *   2. the lead → WON (the caller's)
 *   3. the job — typed from the service, planned days from the estimate — which claims APPROVED → CONVERTED
 *      compare-and-swap as it is created (`createJob` → `markConverted`): the second guard
 *   4. JobLines from the non-optional BOQ rows                            — unique (jobId, quotationItemId)
 *   5. JobRequirements from the take-off (quantities, no rates)
 *   6. the ADVANCE invoice for the ON_ACCEPT stage, sent                   — unique paymentStageId, and
 *      Job.advanceInvoiceId unique
 *
 * Everything read from the library, the templates and the service happens first (`handOffPlan`), outside the
 * transaction. The customer is asked for the advance after it commits (`announceAdvance`).
 */

const SERVICE = { select: { id: true, name: true, jobType: true } };

/**
 * What the hand-off will write, read before the transaction: the job (type from the survey's or the lead's
 * service, REPAIR without one; its checklist template; priority from the survey), the lines, the take-off as
 * requirements, and the advance stage — the ON_ACCEPT stage of the payment schedule, if it has one.
 * @param {object} q  a quotation with items, stages and customer (quotation.service#findQuotation)
 */
export async function handOffPlan(q) {
  const survey = await prisma.siteSurvey.findFirst({
    where: { quotationId: { in: await lineageIds(q) }, deletedAt: null },
    select: { urgency: true, service: SERVICE },
  });
  const lead = q.leadId ? await prisma.lead.findFirst({ where: { id: q.leadId }, select: { service: SERVICE } }) : null;
  const service = survey?.service ?? lead?.service ?? null;
  const template = service
    ? await prisma.jobTemplate.findFirst({ where: { serviceId: service.id, isActive: true, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    : null;

  const rows = q.items ?? [];
  const numbers = boqNumbers(rows);
  const lines = [];
  let section = null;
  rows.forEach((row, i) => {
    if (row.rowType === 'SECTION') { section = row.description; return; }
    if (row.rowType !== 'ITEM' || row.isOptional) return;
    lines.push({
      source: 'QUOTATION', quotationItemId: row.id, number: numbers[i], section, kind: row.kind ?? null,
      description: row.description, unit: row.unit ?? null, quotedQty: row.qty, rate: row.rate,
      measurements: row.measurements ?? undefined, isProvisional: row.isProvisional, sortOrder: lines.length,
    });
  });
  const takeoff = lines.length ? await takeoffFor(rows) : { materials: [], labour: [] };
  const requirements = [
    ...takeoff.materials.map((m) => ({
      kind: 'MATERIAL', materialId: m.materialId, description: m.name ?? 'Material', unit: m.unit ?? null, qty: m.qty, packs: m.packs ?? null,
    })),
    ...takeoff.labour.map((t) => ({ kind: 'LABOUR', tradeId: t.tradeId, description: t.name ?? 'Labour', unit: 'day', qty: t.days })),
  ];

  const schedule = paymentSchedule(q, q.stages ?? []);
  const advanceStage = schedule.find((st) => st.trigger === 'ON_ACCEPT' && st.total > 0) ?? null;
  const [dueDays, gate] = await Promise.all([getSetting('finance.advanceDueDays', 7), getSetting('job.advanceGate', true)]);

  const what = service?.name ?? lines[0]?.description ?? 'Work';
  return {
    job: {
      type: service?.jobType ?? 'REPAIR',
      title: `${what} — ${q.number}`.slice(0, 200),
      description: `Accepted by the customer (${q.number} v${q.version}, ${formatNpr(q.total)}). Schedule and assign.`,
      priority: survey?.urgency ?? 'NORMAL',
      ...(q.estimatedDays ? { plannedDays: q.estimatedDays } : {}),
      ...(template ? { templateId: template.id } : {}),
    },
    lines,
    requirements,
    advanceStage,
    advanceDueDate: addDays(new Date(), Number(dueDays)),
    gateOn: gate === true || gate === 'true',
  };
}

/**
 * Steps 3–6, inside the caller's transaction. `overrides` are the staff convert's own choices (title, type,
 * template, schedule, crew).
 * @returns {Promise<{ job: object, advance: object|null }>}
 */
export async function handOff(tx, q, plan, { actorId, overrides = {} } = {}) {
  const job = await createJob({
    ...plan.job, ...overrides,
    customerId: q.customerId, siteId: q.siteId ?? undefined, leadId: q.leadId ?? undefined, quotationId: q.id,
  }, actorId, tx);
  if (plan.lines.length) await tx.jobLine.createMany({ data: plan.lines.map((l) => ({ ...l, jobId: job.id })) });
  if (plan.requirements.length) await tx.jobRequirement.createMany({ data: plan.requirements.map((r) => ({ ...r, jobId: job.id })) });

  let advance = null;
  if (plan.advanceStage) {
    advance = await createStageInvoice(tx, { kind: 'ADVANCE', quotation: q, stage: plan.advanceStage, jobId: job.id, dueDate: plan.advanceDueDate });
    await tx.job.update({ where: { id: job.id }, data: { advanceInvoiceId: advance.id } });
  }
  return { job, advance };
}

/**
 * The customer is asked for the advance (after the commit): `advance_due` by SMS in their language, with the
 * amount, the due date, the invoice link and where to pay (the `finance.bankAccount` and
 * `finance.fonepayNumber` settings); by email too when one is on file.
 */
export async function announceAdvance(invoice, q) {
  const { customer } = q;
  const [bank, fonepay] = await Promise.all([getSetting('finance.bankAccount', null), getSetting('finance.fonepayNumber', null)]);
  const locale = customer.preferredLocale === 'ne' ? 'ne' : 'en';
  const words = locale === 'ne' ? { bank: 'बैंक', fonepay: 'फोनपे' } : { bank: 'Bank', fonepay: 'Fonepay' };
  const payTo = [bank && `${words.bank}: ${bank}`, fonepay && `${words.fonepay}: ${fonepay}`].filter(Boolean).join(' · ');
  const vars = {
    customerName: customer.name, number: invoice.number, quotation: q.number, amount: formatNpr(invoice.total),
    dueDate: local(invoice.dueDate, 'D MMM YYYY'), link: webUrl(`/invoice/${invoice.publicToken}`), payTo, appName: env.appName,
  };
  await notify({
    templateKey: 'advance_due', channel: 'sms', to: customer.phone, locale, vars,
    related: { model: 'Invoice', id: invoice.id },
    fallbackBody: 'Thank you {{customerName}}. To start the work on {{quotation}}, please pay the advance of {{amount}} by {{dueDate}}: {{link}} {{payTo}} - {{appName}}',
  });
  if (customer.email) {
    await notify({
      templateKey: 'advance_due', channel: 'email', to: customer.email, locale, vars,
      related: { model: 'Invoice', id: invoice.id },
      fallbackSubject: 'Advance for quotation {{quotation}} — {{amount}}',
      fallbackBody: 'Dear {{customerName}},\n\nThank you for accepting quotation {{quotation}}. To start the work, please pay the advance of {{amount}} by {{dueDate}}.\n\nInvoice {{number}}: {{link}}\n{{payTo}}\n\n{{appName}}',
    });
  }
}

/** The advance on a quotation's job, for the customer's pages: what to pay, by when, and where. */
export async function advanceFor(quotationId) {
  const job = await prisma.job.findFirst({
    where: { quotationId, deletedAt: null },
    select: { advanceInvoice: { select: { number: true, total: true, paidAmount: true, dueDate: true, status: true, publicToken: true } } },
  });
  const inv = job?.advanceInvoice;
  if (!inv) return null;
  return {
    number: inv.number, total: inv.total, balance: inv.status === 'VOID' ? 0 : outstanding(inv.total, inv.paidAmount),
    dueDate: inv.dueDate, status: inv.status, url: inv.publicToken ? webUrl(`/invoice/${inv.publicToken}`) : null,
  };
}

/**
 * POST /admin/quotations/:id/convert-to-job (and POST /admin/jobs with a quotationId): the staff way to win the
 * work — the customer accepted by phone. The same hand-off as the customer's Accept, and the lead is won too.
 * The quotation must be APPROVED; a second convert is 422 INVALID_TRANSITION. While an advance will be due, a
 * convert that also dates or crews the job is refused (422 ADVANCE_UNPAID) before anything is written.
 */
export async function convertQuotationToJob(quotationId, input, userId) {
  const q = await findQuotation(quotationId);
  if (input.customerId && input.customerId !== q.customerId) throw badRequest('That quotation belongs to another customer');
  if (q.status === 'CONVERTED') throw new AppError(422, 'INVALID_TRANSITION', 'This quotation has already been converted to a job');
  assertTransition(QUOTATION_TRANSITIONS, q.status, 'CONVERTED', 'quotation');

  const plan = await handOffPlan(q);
  const { customerId: _customer, quotationId: _quotation, title, type, templateId, ...rest } = input;
  if (plan.advanceStage && plan.gateOn && (rest.scheduledStart || rest.technicianIds?.length)) {
    throw new AppError(422, 'ADVANCE_UNPAID',
      `The work waits for its advance of ${formatNpr(plan.advanceStage.total)}. Create the job without a date or a crew; `
      + 'it can be scheduled once the advance is paid, or a manager overrides.',
      { invoiceId: null, invoiceNumber: null, balance: plan.advanceStage.total });
  }

  const overrides = {
    ...rest,
    ...(title ? { title } : {}),
    ...(type ? { type } : {}),
    ...(templateId !== undefined ? { templateId: templateId ?? undefined } : {}),
  };
  const { job, advance } = await prisma.$transaction(async (tx) => {
    const out = await handOff(tx, q, plan, { actorId: userId, overrides });
    if (q.leadId) await winLeadOnAcceptance(tx, q, `Work order ${out.job.number} made from ${q.number} v${q.version}`);
    return out;
  }, { timeout: 20_000 });

  if (job.assignments?.length) await announceAssignment(job, job.assignments.map((a) => a.technicianId));
  if (advance) await announceAdvance(advance, q);
  return getJobDetail(job.id);
}

/**
 * GET /admin/jobs/:id/plan — the Plan tab's hand-off checklist (Phase L6). Quantities only: the lines by
 * section, materials needed against stock with the shortfall, labour days by trade, the crew and its foreman,
 * and whether the site is ready — the advance paid, the BOQ in, materials in stock, a crew, dates, site details.
 */
export async function jobPlan(id) {
  const job = await getJob(id);
  const advance = await advanceState(job);

  const sections = [];
  for (const line of job.lines) {
    const title = line.section ?? 'Works';
    if (sections.at(-1)?.title !== title) sections.push({ title, lines: [] });
    sections.at(-1).lines.push({
      id: line.id, number: line.number, description: line.description, unit: line.unit, quotedQty: line.quotedQty, isProvisional: line.isProvisional,
    });
  }

  const materialReqs = job.requirements.filter((r) => r.kind === 'MATERIAL');
  const labourReqs = job.requirements.filter((r) => r.kind === 'LABOUR');
  const materialIds = materialReqs.map((r) => r.materialId).filter(Boolean);
  const [materialRows, tradeRows, onHand] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, code: true, name: true, unit: true, packSize: true, packLabel: true } }),
    prisma.trade.findMany({ where: { id: { in: labourReqs.map((r) => r.tradeId).filter(Boolean) } }, select: { id: true, code: true, name: true } }),
    materialIds.length ? stockBalances(materialIds) : {},
  ]);
  const materialById = new Map(materialRows.map((m) => [m.id, m]));
  const tradeById = new Map(tradeRows.map((t) => [t.id, t]));
  const materials = materialReqs.map((r) => {
    const m = materialById.get(r.materialId) ?? {};
    const have = onHand[r.materialId] ?? 0;
    return {
      id: r.id, materialId: r.materialId, code: m.code ?? null, name: m.name ?? r.description, unit: m.unit ?? r.unit,
      qty: r.qty, packs: r.packs, packSize: m.packSize ?? null, packLabel: m.packLabel ?? null, onHand: have, shortfall: shortfall(r.qty, have),
    };
  });
  const labour = labourReqs.map((r) => {
    const t = tradeById.get(r.tradeId) ?? {};
    return { id: r.id, tradeId: r.tradeId, code: t.code ?? null, name: t.name ?? r.description, days: r.qty };
  });

  const technicians = job.assignments.map((a) => ({ technicianId: a.technicianId, name: a.technician?.user?.name ?? null, isLead: a.isLead }));
  const lead = technicians.find((t) => t.isLead) ?? null;
  const short = materials.filter((m) => m.shortfall > 0).length;
  const site = job.site;
  const advanceDetail = !advance.required ? 'No advance asked'
    : advance.paid ? 'Paid'
      : advance.overridden ? `Overridden by ${advance.override.by?.name ?? 'a manager'}`
        : `Waiting — invoice ${advance.invoice?.number}`;

  return {
    job: { id: job.id, number: job.number, plannedDays: job.plannedDays, scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd },
    advance,
    sections,
    lineCount: job.lines.length,
    materials,
    labour,
    labourDays: sumQty(labour.map((l) => l.days)),
    crew: { size: technicians.length, lead: lead ? { technicianId: lead.technicianId, name: lead.name } : null, technicians },
    readiness: [
      { key: 'advance', label: 'Advance paid', done: !advance.awaitingAdvance, detail: advanceDetail },
      { key: 'boq', label: 'BOQ imported', done: job.lines.length > 0, detail: `${job.lines.length} line(s) in ${sections.length} section(s)` },
      { key: 'materials', label: 'Materials in stock', done: short === 0, detail: short ? `${short} material(s) short` : 'Everything on hand' },
      { key: 'crew', label: 'Crew and foreman', done: Boolean(lead), detail: lead ? `${technicians.length} on the job, ${lead.name} leads` : 'Nobody assigned' },
      { key: 'schedule', label: 'Dates set', done: Boolean(job.scheduledStart), detail: job.scheduledStart ? local(job.scheduledStart, 'D MMM YYYY') : 'Not scheduled' },
      {
        key: 'site', label: 'Site details',
        done: Boolean(site?.address && (site.contactPhone || job.customer?.phone)),
        detail: site ? [site.address, site.landmark, site.contactName && `${site.contactName} ${site.contactPhone ?? ''}`.trim()].filter(Boolean).join(' · ') : 'No site on the job',
      },
    ],
  };
}
