import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { badRequest, notFound, conflict, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr, dateRange } from '../utils/pagination.js';
import { toPaisa } from '../utils/money.js';
import { normalizePhone } from '../utils/phone.js';
import { LEAD_TRANSITIONS, assertTransition, canTransition } from '../shared/stateMachines.js';
import { BOOKING_SLOTS, CONTACT_ACTIVITY_TYPES } from '../shared/enums.js';
import { adminLeadPath, webUrl } from '../utils/links.js';
import { local, startOfDay } from '../utils/dates.js';
import { computeSlaDueAt, decorateSla, slaWhere } from './sla.service.js';
import { isSlotFull } from './availability.service.js';
import { notify, notifyRoles } from './notify.service.js';
import { getSetting } from './settings.service.js';
import { logger } from '../lib/logger.js';
import { recordEvent } from './audit.service.js';

/** Who a lead can be assigned to — the people who work the pipeline. */
export const ASSIGNABLE_ROLES = ['SALES', 'MANAGER', 'ADMIN'];

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

/** Creates a lead together with its lead.created event. */
function createLeadRow(args) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create(args);
    await recordEvent('lead.created', {
      model: 'Lead',
      recordId: lead.id,
      after: {
        status: lead.status, source: lead.source, priority: lead.priority,
        serviceId: lead.serviceId, assignedToId: lead.assignedToId,
      },
    }, tx);
    return lead;
  });
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

  const lead = await createLeadRow({
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
    link: webUrl(adminLeadPath(lead.id)), appName: env.appName,
  };

  await notifyRoles(['ADMIN', 'SALES', 'MANAGER'], {
    type: 'lead_new',
    title: lead.preferredAt ? `New booking — ${lead.name}` : `New lead — ${lead.name}`,
    body: [lead.phone, lead.service?.name ?? 'General enquiry', lead.preferredAt ? vars.requested : null]
      .filter(Boolean).join(' · '),
    link: adminLeadPath(lead.id),
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
    templateKey: 'lead_ack', channel: 'sms', to: lead.phone, locale: lead.preferredLocale,
    vars, related: { model: 'Lead', id: lead.id },
    fallbackBody: 'Thank you {{leadName}}, we received your request. Our team will call you shortly. - {{appName}}',
  });
}

export async function createLead(input, actorId) {
  const { estimatedAmount, ...rest } = input;
  const lead = await createLeadRow({
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

/**
 * The list filters as a Prisma where. `assignedToId` is a user id or `none`
 * (unassigned); the route has already turned `me` into the caller's id.
 * The SLA and search fragments both use OR, so they are combined with AND.
 */
function leadWhere(query, q) {
  const created = dateRange(query.from, query.to);
  const and = [];
  if (query.slaRisk) and.push(slaWhere(query.slaRisk));
  if (q) and.push({ OR: searchOr(q, ['name', 'phone', 'email', 'address', 'message']) });
  return {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.assignedToId ? { assignedToId: query.assignedToId === 'none' ? null : query.assignedToId } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.requestedVisit === true ? { preferredAt: { not: null } } : {}),
    ...(query.requestedVisit === false ? { preferredAt: null } : {}),
    ...(query.ids?.length ? { id: { in: query.ids } } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export async function listLeads(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const where = leadWhere(query, q);
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
      jobs: {
        where: { deletedAt: null },
        select: {
          id: true, number: true, title: true, status: true, type: true, scheduledStart: true,
          survey: { select: { id: true, number: true, status: true } },
        },
      },
    },
  });
  if (!lead) throw notFound('Lead');
  return decorateSla(lead);
}

export async function updateLead(id, data) {
  await findLead(id);
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

async function findLead(id, client = prisma) {
  const lead = await client.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw notFound('Lead');
  return lead;
}

/**
 * Logging any outbound contact stamps firstResponseAt — that timestamp, not a
 * status change, is what the SLA report measures.
 *
 * Timeline entries are not audited row by row, so each one also writes
 * `lead.activity_logged`: that is how it reaches the lead's History.
 *
 * @returns the activity, plus `sla` — the lead's response state after it — and
 *          `firstResponse: true` when this entry is the one that stopped the clock
 */
export async function addActivity(leadId, { type, summary, meta: metaData }, userId) {
  const lead = await findLead(leadId);
  const stamps = CONTACT_ACTIVITY_TYPES.includes(type) && !lead.firstResponseAt;

  return prisma.$transaction(async (tx) => {
    const activity = await tx.leadActivity.create({
      data: { leadId, userId: userId ?? null, type, summary, meta: metaData ?? undefined },
      include: { user: { select: { id: true, name: true } } },
    });
    const after = stamps
      ? await tx.lead.update({ where: { id: leadId }, data: { firstResponseAt: new Date() } })
      : lead;
    await recordEvent('lead.activity_logged', {
      model: 'Lead',
      recordId: leadId,
      ...(stamps ? { before: { firstResponseAt: null }, after: { firstResponseAt: after.firstResponseAt } } : {}),
      meta: { activityId: activity.id, type, summary },
    }, tx);
    return { ...activity, firstResponse: stamps, sla: decorateSla(after).sla };
  });
}

export async function addNote(leadId, note, userId) {
  await findLead(leadId);
  const row = await prisma.leadNote.create({
    data: { leadId, userId, note },
    include: { user: { select: { id: true, name: true } } },
  });
  await prisma.leadActivity.create({ data: { leadId, userId, type: 'note', summary: note.slice(0, 200) } });
  return row;
}

/**
 * The one way a lead's status changes — staff, convert, customer approval, survey
 * quoting and merge all come through here. Asserts the transition, stamps closedAt
 * on WON/LOST (clearing it on a reopen) and writes the status_change timeline entry,
 * all through the client it is given, so it commits or rolls back with the caller.
 *
 * Moving a lead to the status it already has is a no-op: no write, no entry.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx  a transaction client, or prisma
 * @param {string} leadId
 * @param {string} to
 * @param {{ actorId?: string|null, note?: string, data?: object }} [opts]  data: columns written with the move
 * @returns {Promise<object>} the lead row after the move
 */
export async function transitionLead(tx, leadId, to, { actorId, note, data = {} } = {}) {
  const lead = await tx.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) throw notFound('Lead');
  if (lead.status === to) return lead;
  assertTransition(LEAD_TRANSITIONS, lead.status, to, 'lead');

  // Guarded on the status just read, so two writers racing cannot both apply a move.
  const { count } = await tx.lead.updateMany({
    where: { id: leadId, status: lead.status },
    data: { ...data, status: to, closedAt: ['WON', 'LOST'].includes(to) ? new Date() : null },
  });
  if (count === 0) throw conflict('This lead changed a moment ago. Reload and try again.');

  await tx.leadActivity.create({
    data: {
      leadId, userId: actorId ?? null, type: 'status_change',
      summary: `${lead.status} → ${to}${note ? ` · ${note}` : ''}`,
      meta: { from: lead.status, to },
    },
  });
  await recordEvent('lead.status_changed', {
    model: 'Lead', recordId: leadId, before: { status: lead.status }, after: { status: to }, ...(note ? { meta: { note } } : {}),
  }, tx);
  return tx.lead.findUnique({ where: { id: leadId } });
}

export async function changeStatus(id, { status, lostReason, note }, userId) {
  const lead = await findLead(id);

  await prisma.$transaction((tx) => transitionLead(tx, id, status, {
    actorId: userId,
    note,
    data: {
      lostReason: status === 'LOST' ? lostReason : null,
      firstResponseAt: lead.firstResponseAt ?? (status !== 'NEW' ? new Date() : null),
    },
  }));
  return decorateSla(await prisma.lead.findUnique({ where: { id }, include: LEAD_INCLUDE }));
}

async function assertAssignable(assignedToId) {
  if (!assignedToId) return;
  const user = await prisma.user.findFirst({
    where: { id: assignedToId, isActive: true, deletedAt: null, role: { in: ASSIGNABLE_ROLES } },
  });
  if (!user) throw badRequest('That staff member does not exist, is inactive, or does not work leads');
}

/** One lead's assignment: the column, its timeline entry and its event, through `tx`. */
async function assignInTx(tx, lead, assignedToId, note, actorId) {
  const row = await tx.lead.update({ where: { id: lead.id }, data: { assignedToId }, include: LEAD_INCLUDE });
  await tx.leadActivity.create({
    data: {
      leadId: lead.id, userId: actorId ?? null, type: 'assignment',
      summary: assignedToId ? `Assigned to ${row.assignedTo?.name}${note ? ` · ${note}` : ''}` : 'Unassigned',
    },
  });
  await recordEvent('lead.assigned', {
    model: 'Lead', recordId: lead.id, before: { assignedToId: lead.assignedToId }, after: { assignedToId }, ...(note ? { meta: { note } } : {}),
  }, tx);
  return row;
}

export async function assignLead(id, { assignedToId, note }, actorId) {
  const lead = await findLead(id);
  await assertAssignable(assignedToId);
  const updated = await prisma.$transaction((tx) => assignInTx(tx, lead, assignedToId, note, actorId));
  if (assignedToId && assignedToId !== lead.assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId, type: 'lead_assigned',
        title: `Lead assigned — ${updated.name}`,
        body: `${updated.phone} · respond before the SLA deadline`,
        link: adminLeadPath(id),
      },
    });
  }
  return decorateSla(updated);
}

/**
 * Assigns several leads in one transaction — all or none. Each lead still gets its
 * own timeline entry and `lead.assigned` event; the assignee gets one notification
 * for the batch, not one per lead. Leads already with that owner are left alone.
 *
 * @returns {{ assigned: number, unchanged: number }}
 */
export async function bulkAssign({ ids, assignedToId, note }, actorId) {
  await assertAssignable(assignedToId);
  const leads = await prisma.lead.findMany({ where: { id: { in: ids }, deletedAt: null } });
  if (leads.length !== ids.length) {
    const found = new Set(leads.map((l) => l.id));
    throw notFound(`Lead ${ids.find((i) => !found.has(i))}`);
  }
  const changing = leads.filter((l) => l.assignedToId !== assignedToId);
  await prisma.$transaction(async (tx) => {
    for (const lead of changing) await assignInTx(tx, lead, assignedToId, note, actorId);
  }, { timeout: 15_000 });

  if (assignedToId && changing.length) {
    const [first] = changing;
    await prisma.notification.create({
      data: {
        userId: assignedToId, type: 'lead_assigned',
        title: changing.length === 1 ? `Lead assigned — ${first.name}` : `${changing.length} leads assigned to you`,
        body: changing.length === 1 ? `${first.phone} · respond before the SLA deadline` : 'Respond before each SLA deadline',
        link: changing.length === 1 ? adminLeadPath(first.id) : '/admin/leads',
      },
    });
  }
  return { assigned: changing.length, unchanged: leads.length - changing.length };
}

/** Active staff a lead can be assigned to, for the assign picker and the owner filter. */
export async function listAssignees({ q, limit = 50 } = {}) {
  return prisma.user.findMany({
    where: {
      isActive: true, deletedAt: null, role: { in: ASSIGNABLE_ROLES },
      ...(q ? { OR: searchOr(q, ['name', 'email']) } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
    take: limit,
  });
}

export async function getAssignee(id) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: { in: ASSIGNABLE_ROLES } },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user) throw notFound('Staff member');
  return user;
}

/** Merges duplicates into a primary lead, moving notes/activities and soft-deleting the rest. */
export async function mergeLeads({ primaryId, duplicateIds }, actorId) {
  const ids = duplicateIds.filter((d) => d !== primaryId);
  if (!ids.length) throw badRequest('Nothing to merge');
  const primary = await prisma.lead.findFirst({ where: { id: primaryId, deletedAt: null } });
  if (!primary) throw notFound('Primary lead');

  const duplicates = await prisma.lead.findMany({
    where: { id: { in: ids }, deletedAt: null }, select: { id: true, name: true, status: true },
  });
  // A merged duplicate is closed as LOST. A WON lead carries the customer's yes,
  // and burying it would erase that — it has to be the primary instead.
  const stuck = duplicates.find((d) => !canTransition(LEAD_TRANSITIONS, d.status, 'LOST'));
  if (stuck) {
    throw unprocessable(`The lead for ${stuck.name} is ${stuck.status} and cannot be merged away. Make it the primary lead instead.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadNote.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } });
    await tx.leadActivity.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } });
    await tx.quotation.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } });
    await tx.job.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primaryId } });
    for (const d of duplicates) {
      await transitionLead(tx, d.id, 'LOST', {
        actorId, note: `Merged into ${primary.id}`, data: { lostReason: `Merged into ${primary.id}` },
      });
    }
    await tx.lead.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    await tx.leadActivity.create({
      data: { leadId: primaryId, userId: actorId ?? null, type: 'note', summary: `Merged ${ids.length} duplicate lead(s)` },
    });
    await recordEvent('lead.merged', { model: 'Lead', recordId: primaryId, meta: { duplicateIds: ids } }, tx);
  });
  return getLead(primaryId);
}

/**
 * Other live leads with this lead's phone (or alt phone) or email, with what a merge
 * would move into the primary — the merge preview reads the counts.
 */
export async function findDuplicates(id) {
  const lead = await findLead(id);
  const phones = [lead.phone, lead.altPhone].filter(Boolean);
  const leads = await prisma.lead.findMany({
    where: {
      id: { not: id },
      deletedAt: null,
      OR: [
        { phone: { in: phones } },
        { altPhone: { in: phones } },
        ...(lead.email ? [{ email: { equals: lead.email, mode: 'insensitive' } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { ...LEAD_INCLUDE, _count: { select: { notes: true, activities: true, quotations: true, jobs: true } } },
  });
  return leads.map((l) => ({
    ...decorateSla(l),
    matchedOn: phones.includes(l.phone) || phones.includes(l.altPhone) ? 'phone' : 'email',
  }));
}

export async function deleteLead(id) {
  await findLead(id);
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * SLA board: what sales needs to look at right now, plus today's score — how many of the
 * leads first answered today were answered inside the promise. "Today" is Kathmandu's day,
 * whatever timezone the server runs in.
 */
export async function slaBoard() {
  const today = startOfDay();
  const [breached, atRisk, newToday, answered] = await Promise.all([
    prisma.lead.findMany({ where: { deletedAt: null, ...slaWhere('breached') }, include: LEAD_INCLUDE, orderBy: { slaDueAt: 'asc' }, take: 50 }),
    prisma.lead.findMany({ where: { deletedAt: null, ...slaWhere('at_risk') }, include: LEAD_INCLUDE, orderBy: { slaDueAt: 'asc' }, take: 50 }),
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.lead.findMany({
      where: { deletedAt: null, firstResponseAt: { gte: today }, slaDueAt: { not: null } },
      select: { firstResponseAt: true, slaDueAt: true },
    }),
  ]);
  return {
    breached: breached.map(decorateSla),
    atRisk: atRisk.map(decorateSla),
    newToday,
    answeredToday: answered.length,
    metToday: answered.filter((l) => l.firstResponseAt <= l.slaDueAt).length,
  };
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
