import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/AppError.js';
import { can } from '../shared/permissions.js';
import { lineAmount, pctOf, proRata, sum } from '../utils/money.js';
import { diffQty, sumQty } from '../utils/quantity.js';
import { getSetting } from './settings.service.js';

/**
 * The job on site, as the office reads it (Phase L7): its BOQ with progress and earned value, and the materials
 * and labour it was planned to need against what was issued and logged.
 */

/** Earned value is selling money: shown to those who read quotations or invoices, not to dispatch. */
const seesValue = (role) => can(role, 'quotations:read') || can(role, 'invoices:read');

/**
 * GET /admin/jobs/:id/progress — the lines by section with their progress; for `seesValue` roles each line's
 * value (quoted qty × rate) and earned value (value × progress), all money.js. `earnedPct` is earned against
 * the job's value. A MILESTONE stage of the quotation's schedule is `due` once earned value reaches its
 * cumulative share and no bill has taken it; `nextBill` is the first — the tab's prompt for the running bill
 * (raised in L8). An omission (a variation's negative line) counts against the value.
 */
export async function jobProgress(jobId, { role } = {}) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      id: true, quotationId: true,
      lines: { orderBy: { sortOrder: 'asc' } },
      quotation: { select: { stages: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!job) throw notFound('Job');
  const money = seesValue(role);

  const rows = job.lines.map((l) => {
    const value = lineAmount(l.quotedQty, l.rate);
    return { line: l, value, earned: proRata(value, l.progressPct, 100) };
  });
  const value = sum(rows.map((r) => r.value));
  const earned = sum(rows.map((r) => r.earned));
  const earnedPct = pctOf(earned, value);

  const sections = [];
  for (const { line, value: v, earned: e } of rows) {
    const title = line.section ?? 'Works';
    if (sections.at(-1)?.title !== title) sections.push({ title, lines: [] });
    sections.at(-1).lines.push({
      id: line.id, number: line.number, source: line.source, description: line.description, unit: line.unit,
      quotedQty: line.quotedQty, measuredQty: line.measuredQty, progressPct: line.progressPct, isProvisional: line.isProvisional,
      ...(money ? { rate: line.rate, value: v, earned: e } : {}),
    });
  }

  const stageRows = job.quotation?.stages ?? [];
  const bills = new Map((await prisma.invoice.findMany({
    where: { paymentStageId: { in: stageRows.map((st) => st.id) }, status: { not: 'VOID' }, deletedAt: null },
    select: { id: true, number: true, status: true, paymentStageId: true },
  })).map((i) => [i.paymentStageId, { id: i.id, number: i.number, status: i.status }]));
  let cumulative = 0;
  const stages = stageRows.map((st) => {
    cumulative += st.basisPoints;
    const invoice = bills.get(st.id) ?? null;
    return {
      id: st.id, label: st.label, basisPoints: st.basisPoints, trigger: st.trigger, cumulativeBp: cumulative,
      billed: Boolean(invoice), invoice, due: st.trigger === 'MILESTONE' && !invoice && earnedPct * 100 >= cumulative,
    };
  });
  const next = stages.find((st) => st.due) ?? null;

  return {
    sections,
    totals: { earnedPct, ...(money ? { value, earned } : {}) },
    stages,
    nextBill: next ? { stageId: next.id, label: next.label, basisPoints: next.basisPoints } : null,
  };
}

/**
 * GET /admin/jobs/:id/planned-vs-actual — per material: planned (the requirements), issued (the job's
 * materials), received on site (the diary's challans); per trade: planned labour days against the days the
 * diary logged — headcount × the hours worked out of `job.workdayHours` (8), a lost afternoon counting half.
 * Quantities only. `overPlan`: more issued than planned, or issued without a plan on a job that has one.
 */
export async function plannedVsActual(jobId) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    select: {
      id: true,
      requirements: true,
      materials: { select: { materialId: true, qty: true } },
      diaries: { select: { headcount: true, received: true, lostHours: true } },
      timeLogs: { select: { minutes: true } },
    },
  });
  if (!job) throw notFound('Job');
  const workday = Number(await getSetting('job.workdayHours', 8)) || 8;
  const hasPlan = job.requirements.length > 0;

  const group = (entries) => {
    const map = new Map();
    for (const [key, qty] of entries) {
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), qty]);
    }
    return new Map([...map].map(([k, qtys]) => [k, sumQty(qtys)]));
  };
  const planned = group(job.requirements.filter((r) => r.kind === 'MATERIAL').map((r) => [r.materialId, r.qty]));
  const issued = group(job.materials.map((m) => [m.materialId, m.qty]));
  const received = group(job.diaries.flatMap((d) => (d.received ?? []).map((r) => [r.materialId, r.qty])));
  const materialIds = [...new Set([...planned.keys(), ...issued.keys(), ...received.keys()])];
  const materialRows = await prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, code: true, name: true, unit: true } });
  const materialById = new Map(materialRows.map((m) => [m.id, m]));

  const plannedDays = group(job.requirements.filter((r) => r.kind === 'LABOUR').map((r) => [r.tradeId, r.qty]));
  const loggedDays = group(job.diaries.flatMap((d) => {
    const share = Math.max(0, workday - Number(d.lostHours || 0)) / workday;
    return (d.headcount ?? []).map((h) => [h.tradeId, Number(h.count || 0) * share]);
  }));
  const tradeIds = [...new Set([...plannedDays.keys(), ...loggedDays.keys()])];
  const tradeRows = await prisma.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true, code: true, name: true } });
  const tradeById = new Map(tradeRows.map((t) => [t.id, t]));

  return {
    materials: materialIds.map((id) => {
      const m = materialById.get(id) ?? {};
      const p = planned.get(id) ?? 0;
      const i = issued.get(id) ?? 0;
      return {
        materialId: id, code: m.code ?? null, name: m.name ?? null, unit: m.unit ?? null,
        planned: p, issued: i, received: received.get(id) ?? 0, variance: diffQty(i, p),
        overPlan: hasPlan && i > p,
      };
    }),
    labour: tradeIds.map((id) => {
      const t = tradeById.get(id) ?? {};
      return { tradeId: id, code: t.code ?? null, name: t.name ?? null, plannedDays: plannedDays.get(id) ?? 0, loggedDays: loggedDays.get(id) ?? 0 };
    }),
    technicianHours: Math.round(sum(job.timeLogs.map((t) => t.minutes ?? 0)) / 6) / 10,
    workdayHours: workday,
  };
}

/**
 * The OVER_PLAN warning (Phase L7) for a material just issued to a job: the job's issued total now passes what
 * it was planned to need — or, on a job with a plan, the material was not planned at all. A warning, never a
 * refusal: the office knows things the plan does not.
 * @returns {Promise<object[]>} `meta.warnings`
 */
export async function overPlanWarnings(jobId, materialId) {
  const [requirements, planCount, issued, material] = await Promise.all([
    prisma.jobRequirement.findMany({ where: { jobId, kind: 'MATERIAL', materialId }, select: { qty: true } }),
    prisma.jobRequirement.count({ where: { jobId } }),
    prisma.jobMaterial.findMany({ where: { jobId, materialId }, select: { qty: true } }),
    prisma.material.findUnique({ where: { id: materialId }, select: { name: true, unit: true } }),
  ]);
  if (!planCount) return [];
  const plannedQty = sumQty(requirements.map((r) => r.qty));
  const issuedQty = sumQty(issued.map((i) => i.qty));
  if (issuedQty <= plannedQty) return [];
  return [{ code: 'OVER_PLAN', materialId, name: material?.name ?? null, unit: material?.unit ?? null, planned: plannedQty, issued: issuedQty }];
}
