import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { addMinutes } from '../utils/dates.js';
import { getSetting } from './settings.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { logger } from '../lib/logger.js';
import { adminLeadPath, webUrl } from '../utils/links.js';

/** Response-time budget in minutes, overridable from Settings. */
export async function slaMinutes() {
  return Number(await getSetting('sla.leadResponseMinutes', env.business.slaLeadMinutes));
}

export async function computeSlaDueAt(createdAt = new Date()) {
  return addMinutes(createdAt, await slaMinutes());
}

/**
 * SLA state for a lead.
 * @returns {'met'|'breached'|'at_risk'|'ok'|'none'}
 */
export function slaState(lead, warnBeforeMinutes = env.business.slaWarnBeforeMinutes) {
  if (!lead.slaDueAt) return 'none';
  if (lead.firstResponseAt) return lead.firstResponseAt <= lead.slaDueAt ? 'met' : 'breached';
  const now = Date.now();
  const due = new Date(lead.slaDueAt).getTime();
  if (now > due) return 'breached';
  if (due - now <= warnBeforeMinutes * 60000) return 'at_risk';
  return 'ok';
}

export function decorateSla(lead) {
  if (!lead) return lead;
  const state = slaState(lead);
  const minutesRemaining = lead.slaDueAt && !lead.firstResponseAt
    ? Math.round((new Date(lead.slaDueAt).getTime() - Date.now()) / 60000)
    : null;
  return { ...lead, sla: { state, minutesRemaining, dueAt: lead.slaDueAt, respondedAt: lead.firstResponseAt } };
}

/** Prisma where-fragment for ?slaRisk= filtering. */
export function slaWhere(risk, warnBeforeMinutes = env.business.slaWarnBeforeMinutes) {
  const now = new Date();
  if (risk === 'breached') {
    return { firstResponseAt: null, slaDueAt: { lt: now }, status: { notIn: ['WON', 'LOST'] } };
  }
  if (risk === 'at_risk') {
    return {
      firstResponseAt: null,
      slaDueAt: { gte: now, lte: addMinutes(now, warnBeforeMinutes) },
      status: { notIn: ['WON', 'LOST'] },
    };
  }
  if (risk === 'ok') {
    return { OR: [{ firstResponseAt: { not: null } }, { slaDueAt: { gt: addMinutes(now, warnBeforeMinutes) } }] };
  }
  return {};
}

/**
 * Called by the SLA worker/cron. Warns on leads approaching the deadline and
 * escalates the ones that have passed it. Idempotent: a lead is only flagged once.
 */
export async function runSlaSweep() {
  const warnBefore = Number(await getSetting('sla.warnBeforeMinutes', env.business.slaWarnBeforeMinutes));
  const now = new Date();

  const breached = await prisma.lead.findMany({
    where: {
      deletedAt: null, firstResponseAt: null, slaBreached: false,
      slaDueAt: { lt: now }, status: { notIn: ['WON', 'LOST'] },
    },
    include: { assignedTo: { select: { id: true, name: true, email: true, phone: true } } },
    take: 200,
  });

  for (const lead of breached) {
    await prisma.lead.update({ where: { id: lead.id }, data: { slaBreached: true, priority: 'URGENT' } });
    await notifyRoles(['ADMIN'], {
      type: 'lead_sla_breach',
      title: `SLA breached — ${lead.name}`,
      body: `No response within the promised window. Phone ${lead.phone}.`,
      link: adminLeadPath(lead.id),
    });
    if (lead.assignedTo?.email) {
      await notify({
        templateKey: 'lead_sla_breach', channel: 'email', to: lead.assignedTo.email,
        vars: { staffName: lead.assignedTo.name, leadName: lead.name, phone: lead.phone, link: webUrl(adminLeadPath(lead.id)) },
        related: { model: 'Lead', id: lead.id },
        fallbackSubject: `SLA BREACHED: ${lead.name}`,
        fallbackBody: 'Lead {{leadName}} ({{phone}}) passed the response deadline with no contact logged.',
      });
    }
    logger.warn({ leadId: lead.id }, 'lead SLA breached');
  }

  const atRisk = await prisma.lead.findMany({
    where: {
      deletedAt: null, firstResponseAt: null, slaBreached: false,
      slaDueAt: { gte: now, lte: addMinutes(now, warnBefore) },
      status: { notIn: ['WON', 'LOST'] },
    },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
    take: 200,
  });

  for (const lead of atRisk) {
    const already = await prisma.notification.findFirst({
      where: { type: 'lead_sla_warn', link: adminLeadPath(lead.id) },
      select: { id: true },
    });
    if (already) continue;
    await notifyRoles(lead.assignedTo ? ['ADMIN', 'SALES'] : ['ADMIN', 'SALES'], {
      type: 'lead_sla_warn',
      title: `Response due soon — ${lead.name}`,
      body: `Call ${lead.phone} before the promised deadline.`,
      link: adminLeadPath(lead.id),
    });
  }

  return { breached: breached.length, atRisk: atRisk.length };
}
