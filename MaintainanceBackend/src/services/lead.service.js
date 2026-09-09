import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { badRequest, notFound, conflict } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr, dateRange } from '../utils/pagination.js';
import { toPaisa } from '../utils/money.js';
import { normalizePhone } from '../utils/phone.js';
import { LEAD_TRANSITIONS, assertTransition } from '../shared/stateMachines.js';
import { BOOKING_SLOTS } from '../shared/enums.js';
import { local } from '../utils/dates.js';
import { computeSlaDueAt, decorateSla, slaWhere } from './sla.service.js';
import { isSlotFull } from './availability.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { getSetting } from './settings.service.js';
import { logger } from '../lib/logger.js';

const LEAD_INCLUDE = {
  service: { select: { id: true, name: true, slug: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  customer: { select: { id: true, name: true, phone: true } },
};

/** Verifies a Cloudflare Turnstile token when the secret is configured. */
async function verifyTurnstile(token, ip) {
  if (!env.turnstileSecret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.turnstileSecret, response: token, remoteip: ip }),
    });
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    logger.warn({ err: err.message }, 'turnstile verification failed');
    return false;
  }
}

/** Round-robin assignment across active SALES users. */
async function pickAssignee() {
  const auto = await getSetting('sla.autoAssign', true);
  if (!auto) return null;
  const candidates = await prisma.user.findMany({
    where: { role: 'SALES', isActive: true, deletedAt: null },
    select: { id: true, _count: { select: { assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } } } } },
  });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads)[0].id;
}

/** Public form submission. Spam checks run before anything is written. */
export async function createPublicLead(input, { ip, userAgent }) {
  if (input.website) throw badRequest('Submission rejected');
  if (input.elapsedMs !== undefined && input.elapsedMs < 2000) {
    throw badRequest('That was submitted too quickly. Please try again.');
  }
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    throw badRequest('Bot verification failed. Please reload the page and try again.');
  }

  const phone = normalizePhone(input.phone);

  if (input.preferredAt) {
    const closed = await getSetting('booking.closedWeekdays', [6]);
    const weekday = Number(local(input.preferredAt, 'd'));
    if (Array.isArray(closed) && closed.includes(weekday)) {
      throw badRequest('We are closed that day. Please choose another date.');
    }
  }

  // Re-submissions within an hour update the existing lead instead of duplicating it.
  const recent = await prisma.lead.findFirst({
    where: { phone, deletedAt: null, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    // A second submission inside the hour is the same customer, not a new lead.
    // A booking still carries new intent, so fold the slot onto the open lead
    // rather than dropping it on the floor.
    const booking = input.preferredAt
      ? {
        preferredAt: input.preferredAt,
        preferredSlot: input.preferredSlot ?? null,
        serviceId: input.serviceId ?? recent.serviceId,
        source: 'booking',
        ...(input.estimatedAmount != null ? { estimatedAmount: toPaisa(input.estimatedAmount) } : {}),
      }
      : null;
    const lead = booking
      ? await prisma.lead.update({ where: { id: recent.id }, data: booking, include: LEAD_INCLUDE })
      : recent;

    await prisma.leadActivity.create({
      data: {
        leadId: recent.id,
        type: 'note',
        summary: booking ? 'Customer booked a visit slot' : 'Customer submitted the form again',
        meta: { message: input.message ?? null, preferredAt: input.preferredAt ?? null, preferredSlot: input.preferredSlot ?? null },
      },
    });
    return decorateSla(lead);
  }

  const { website, turnstileToken, elapsedMs, estimatedAmount, ...rest } = input;

  // A slot with no surveyor left is not a reason to refuse the customer. Take the
  // booking, raise it so someone calls to reschedule, and say so on the timeline.
  const oversubscribed = input.preferredAt
    ? await isSlotFull(input.preferredAt, input.preferredSlot).catch(() => false)
    : false;

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      phone,
      estimatedAmount: estimatedAmount != null ? toPaisa(estimatedAmount) : null,
      source: input.preferredAt ? 'booking' : input.estimatePayload ? 'estimator' : 'web_form',
      priority: oversubscribed ? 'HIGH' : undefined,
      slaDueAt: await computeSlaDueAt(),
      assignedToId: await pickAssignee(),
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 400) ?? null,
    },
    include: LEAD_INCLUDE,
  });

  if (oversubscribed) {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'note',
        summary: 'Booked into a slot with no surveyor capacity — call to reschedule',
        meta: { preferredAt: lead.preferredAt, preferredSlot: lead.preferredSlot },
      },
    });
  }

  await announceNewLead(lead);
  return decorateSla(lead);
}

/** "Sun 07 Sep, morning (8:00 – 12:00)" — what dispatch needs to see first. */
function describeRequestedVisit(lead) {
  if (!lead.preferredAt) return '-';
  const slot = BOOKING_SLOTS.find((s) => s.key === lead.preferredSlot);
  const day = local(lead.preferredAt, 'ddd DD MMM');
  return slot ? `${day}, ${slot.label.toLowerCase()} (${slot.window})` : day;
}

async function announceNewLead(lead) {
  const onCall = await getSetting('contact.onCallPhone', null);
  const salesEmail = await getSetting('contact.salesEmail', null);
  const vars = {
    leadName: lead.name, phone: lead.phone, address: lead.address ?? '-',
    service: lead.service?.name ?? 'General enquiry', message: lead.message ?? '-',
    requested: describeRequestedVisit(lead),
    link: `${env.appUrl}/leads/${lead.id}`, appName: env.appName,
  };

  await notifyRoles(['ADMIN', 'SALES'], {
    type: 'lead_new',
    title: lead.preferredAt ? `New booking — ${lead.name}` : `New lead — ${lead.name}`,
    body: [lead.phone, lead.service?.name ?? 'General enquiry', lead.preferredAt ? vars.requested : null]
      .filter(Boolean).join(' · '),
    link: `/leads/${lead.id}`,
  });

  if (onCall) {
    await notify({
      templateKey: 'lead_new', channel: 'sms', to: String(onCall), vars,
      related: { model: 'Lead', id: lead.id },
      fallbackBody: 'New lead: {{leadName}}, {{phone}}. {{service}}. Requested: {{requested}}. Respond within the promised window.',
    });
  }
  if (salesEmail) {
    await notify({
      templateKey: 'lead_new', channel: 'email', to: String(salesEmail), vars,
      related: { model: 'Lead', id: lead.id },
      fallbackSubject: 'New lead: {{leadName}} ({{phone}})',
      fallbackBody:
        'Name: {{leadName}}\nPhone: {{phone}}\nAddress: {{address}}\nService: {{service}}\nRequested visit: {{requested}}\n\n{{message}}\n\nOpen: {{link}}',
    });
  }

  // Acknowledge to the customer — this is what makes the "we respond fast" promise visible.
  await notify({
    templateKey: 'lead_ack', channel: 'sms', to: lead.phone,
    vars, related: { model: 'Lead', id: lead.id },
    fallbackBody: 'Thank you {{leadName}}, we received your request. Our team will call you shortly. - {{appName}}',
  });
}

export async function createLead(input, actorId) {
  const { estimatedAmount, ...rest } = input;
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      phone: normalizePhone(input.phone),
      estimatedAmount: estimatedAmount != null ? toPaisa(estimatedAmount) : null,
      slaDueAt: await computeSlaDueAt(),
      assignedToId: input.assignedToId ?? actorId ?? (await pickAssignee()),
    },
    include: LEAD_INCLUDE,
  });
  return decorateSla(lead);
}

export async function listLeads(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const created = dateRange(query.from, query.to);
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(query.slaRisk ? slaWhere(query.slaRisk) : {}),
    ...(q ? { OR: searchOr(q, ['name', 'phone', 'email', 'address', 'message']) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy, skip, take, include: LEAD_INCLUDE }),
    prisma.lead.count({ where }),
  ]);
  return { items: items.map(decorateSla), meta: meta({ page, limit, total }) };
}

export async function getLead(id) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...LEAD_INCLUDE,
      notes: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      activities: { orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true } } } },
      quotations: { select: { id: true, number: true, status: true, total: true, createdAt: true } },
      jobs: { select: { id: true, number: true, status: true, type: true, scheduledStart: true } },
    },
  });
  if (!lead) throw notFound('Lead');
  return decorateSla(lead);
}

export async function updateLead(id, data) {
  await getLead(id);
  const { estimatedAmount, ...rest } = data;
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      ...(data.phone ? { phone: normalizePhone(data.phone) } : {}),
      ...(estimatedAmount !== undefined ? { estimatedAmount: estimatedAmount != null ? toPaisa(estimatedAmount) : null } : {}),
    },
    include: LEAD_INCLUDE,
  });
  return decorateSla(lead);
}

/**
 * Logging any outbound contact stamps firstResponseAt — that timestamp, not a
 * status change, is what the SLA report measures.
 */
export async function addActivity(leadId, { type, summary, meta: metaData }, userId) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw notFound('Lead');

  const isContact = ['call', 'sms', 'email', 'whatsapp', 'visit'].includes(type);
  const [activity] = await prisma.$transaction([
    prisma.leadActivity.create({ data: { leadId, userId: userId ?? null, type, summary, meta: metaData ?? undefined } }),
    ...(isContact && !lead.firstResponseAt
      ? [prisma.lead.update({ where: { id: leadId }, data: { firstResponseAt: new Date() } })]
      : []),
  ]);
  return activity;
}

export async function addNote(leadId, note, userId) {
  await prisma.lead.findFirstOrThrow({ where: { id: leadId, deletedAt: null } }).catch(() => { throw notFound('Lead'); });
  const row = await prisma.leadNote.create({
    data: { leadId, userId, note },
    include: { user: { select: { id: true, name: true } } },
  });
  await prisma.leadActivity.create({ data: { leadId, userId, type: 'note', summary: note.slice(0, 200) } });
  return row;
}

export async function changeStatus(id, { status, lostReason, note }, userId) {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw notFound('Lead');
  assertTransition(LEAD_TRANSITIONS, lead.status, status, 'lead');

  const closing = ['WON', 'LOST'].includes(status);
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status,
      lostReason: status === 'LOST' ? lostReason : null,
      closedAt: closing ? new Date() : null,
      firstResponseAt: lead.firstResponseAt ?? (status !== 'NEW' ? new Date() : null),
    },
    include: LEAD_INCLUDE,
  });
  await prisma.leadActivity.create({
    data: {
      leadId: id, userId: userId ?? null, type: 'status_change',
      summary: `${lead.status} → ${status}${note ? ` · ${note}` : ''}`,
      meta: { from: lead.status, to: status },
    },
  });
  return decorateSla(updated);
}

export async function assignLead(id, { assignedToId, note }, actorId) {
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw notFound('Lead');
  if (assignedToId) {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, isActive: true, deletedAt: null } });
    if (!user) throw badRequest('That staff member does not exist or is inactive');
  }
  const updated = await prisma.lead.update({ where: { id }, data: { assignedToId }, include: LEAD_INCLUDE });
  await prisma.leadActivity.create({
    data: {
      leadId: id, userId: actorId ?? null, type: 'assignment',
      summary: assignedToId ? `Assigned to ${updated.assignedTo?.name}${note ? ` · ${note}` : ''}` : 'Unassigned',
    },
  });
  if (assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId, type: 'lead_assigned',
        title: `Lead assigned — ${updated.name}`,
        body: `${updated.phone} · respond before the SLA deadline`,
        link: `/leads/${id}`,
      },
    });
  }
  return decorateSla(updated);
}

/** Merges duplicates into a primary lead, moving notes/activities and soft-deleting the rest. */
export async function mergeLeads({ primaryId, duplicateIds }, actorId) {
  const ids = duplicateIds.filter((d) => d !== primaryId);
  if (!ids.length) throw badRequest('Nothing to merge');
  const primary = await prisma.lead.findFirst({ where: { id: primaryId, deletedAt: null } });
  if (!primary) throw notFound('Primary lead');

  await prisma.$transaction([
    prisma.leadNote.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } }),
    prisma.leadActivity.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } }),
    prisma.quotation.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } }),
    prisma.job.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } }),
    prisma.lead.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), status: 'LOST', lostReason: `Merged into ${primary.id}` } }),
    prisma.leadActivity.create({
      data: { leadId: primaryId, userId: actorId ?? null, type: 'note', summary: `Merged ${ids.length} duplicate lead(s)` },
    }),
  ]);
  return getLead(primaryId);
}

/** Finds other open leads sharing this phone number. */
export async function findDuplicates(id) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw notFound('Lead');
  return prisma.lead.findMany({
    where: { id: { not: id }, phone: lead.phone, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: LEAD_INCLUDE,
  });
}

export async function deleteLead(id) {
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** SLA board: what sales needs to look at right now. */
export async function slaBoard() {
  const [breached, atRisk, newToday] = await Promise.all([
    prisma.lead.findMany({ where: { deletedAt: null, ...slaWhere('breached') }, include: LEAD_INCLUDE, orderBy: { slaDueAt: 'asc' }, take: 50 }),
    prisma.lead.findMany({ where: { deletedAt: null, ...slaWhere('at_risk') }, include: LEAD_INCLUDE, orderBy: { slaDueAt: 'asc' }, take: 50 }),
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  return { breached: breached.map(decorateSla), atRisk: atRisk.map(decorateSla), newToday };
}

export async function exportLeadsCsv(query) {
  const { items } = await listLeads({ ...query, limit: 100, page: 1 });
  const all = [];
  let page = 1;
  let batch = items;
  while (batch.length) {
    all.push(...batch);
    if (all.length >= 10000) break;
    page += 1;
    ({ items: batch } = await listLeads({ ...query, limit: 100, page }));
  }
  const header = [
    'Number', 'Name', 'Phone', 'Email', 'Address', 'Area', 'Service', 'Source', 'Status',
    'Priority', 'Assigned To', 'SLA State', 'Created At', 'First Response At', 'Message',
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = all.map((l, i) =>
    [
      i + 1, l.name, l.phone, l.email, l.address, l.area, l.service?.name, l.source, l.status,
      l.priority, l.assignedTo?.name, l.sla?.state, l.createdAt?.toISOString?.() ?? l.createdAt,
      l.firstResponseAt?.toISOString?.() ?? '', l.message,
    ].map(escape).join(','),
  );
  return [header.map(escape).join(','), ...rows].join('\n');
}
