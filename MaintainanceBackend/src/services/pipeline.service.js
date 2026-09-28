import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { getSetting } from './settings.service.js';
import { userIdsWithRoles } from './notify.service.js';
import { APPROVER_ROLES } from './quotation.service.js';
import { addDays, addMinutes, dayjs, endOfDay, startOfDay } from '../utils/dates.js';
import { adminLeadPath, adminLeadsPath, adminQuotationPath, adminSurveyPath } from '../utils/links.js';

/**
 * The pipeline's clocks after the first response (Phase L1): a lead's next action falling due, the
 * morning digest, and the stale reminders. Every reminder is in-app and goes once — see `remindOnce`.
 */

const OPEN = { notIn: ['WON', 'LOST'] };
const HOUR = 60;

const NEXT_ACTION_LABELS = {
  CALL: 'Call', BOOK_VISIT: 'Book the visit', VISIT: 'Site visit', SEND_QUOTE: 'Send the quotation', FOLLOW_UP: 'Follow up',
};

/** The office's calendar day of an instant, `YYYY-MM-DD` — the unit of "once a day". */
const ktmDay = (date) => dayjs(date).tz(env.business.timezone).format('YYYY-MM-DD');
const ktmHour = (date) => Number(dayjs(date).tz(env.business.timezone).format('H'));
const setting = async (key, fallback) => Number(await getSetting(key, fallback));

/**
 * In-app reminders that go once. Each row's `dedupeKey` is `<key>:<userId>` and unique in the table,
 * so a second sweep — or a second instance running the same sweep — inserts nothing.
 * Inactive and deleted users are skipped.
 * @returns {Promise<number>} how many were created
 */
export async function remindOnce(userIds, key, { type, title, body, link }) {
  const wanted = [...new Set(userIds.filter(Boolean))];
  if (!wanted.length) return 0;
  const active = await prisma.user.findMany({ where: { id: { in: wanted }, isActive: true, deletedAt: null }, select: { id: true } });
  if (!active.length) return 0;
  const { count } = await prisma.notification.createMany({
    data: active.map(({ id }) => ({ userId: id, type, title, body: body ?? null, link, dedupeKey: `${key}:${id}` })),
    skipDuplicates: true,
  });
  return count;
}

/** Who hears about a lead: its owner, or the managers while nobody owns it. */
let managersCache = null;
async function ownerOr(ownerIds) {
  const owners = ownerIds.filter(Boolean);
  if (owners.length) return owners;
  managersCache ??= userIdsWithRoles(['MANAGER', 'ADMIN']);
  return managersCache;
}

/**
 * The `leads:followups` task (every 15 minutes):
 * - a next action that has fallen due tells its owner, once per booked time (a rescheduled action
 *   reminds again). Only the last two days are looked at, so an old backlog cannot crowd out new ones.
 * - once per Kathmandu day, from `pipeline.digestHour` (09:00), each owner gets a digest of what is
 *   due today and what is overdue. The task runs hourly-or-faster rather than at a clock time.
 * @param {Date} [now]
 */
export async function runFollowUps(now = new Date()) {
  managersCache = null;
  const due = await prisma.lead.findMany({
    where: { deletedAt: null, status: OPEN, nextActionAt: { lte: now, gt: addDays(now, -2) } },
    select: { id: true, name: true, phone: true, assignedToId: true, nextActionAt: true, nextActionType: true, nextActionNote: true },
    orderBy: { nextActionAt: 'asc' },
    take: 500,
  });
  let reminded = 0;
  for (const lead of due) {
    reminded += await remindOnce(await ownerOr([lead.assignedToId]), `followup:due:${lead.id}:${lead.nextActionAt.toISOString()}`, {
      type: 'lead_followup_due',
      title: `${NEXT_ACTION_LABELS[lead.nextActionType] ?? 'Follow up'} — ${lead.name}`,
      body: lead.nextActionNote ?? `Phone ${lead.phone}`,
      link: adminLeadPath(lead.id),
    });
  }

  let digests = 0;
  if (ktmHour(now) >= (await setting('pipeline.digestHour', 9))) {
    const where = { deletedAt: null, status: OPEN, assignedToId: { not: null } };
    const [today, overdue] = await Promise.all([
      prisma.lead.groupBy({ by: ['assignedToId'], where: { ...where, nextActionAt: { gte: startOfDay(now), lte: endOfDay(now) } }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['assignedToId'], where: { ...where, nextActionAt: { lt: startOfDay(now) } }, _count: { _all: true } }),
    ]);
    const counts = new Map();
    for (const g of today) counts.set(g.assignedToId, { today: g._count._all, overdue: 0 });
    for (const g of overdue) counts.set(g.assignedToId, { today: counts.get(g.assignedToId)?.today ?? 0, overdue: g._count._all });
    const day = ktmDay(now);
    for (const [userId, c] of counts) {
      digests += await remindOnce([userId], `followup:digest:${day}`, {
        type: 'lead_followup_digest',
        title: `Today: ${c.today} follow-up${c.today === 1 ? '' : 's'}${c.overdue ? `, ${c.overdue} overdue` : ''}`,
        body: 'Your leads with a next action due today — work the overdue ones first.',
        link: adminLeadsPath({ nextAction: c.overdue ? 'overdue' : 'due_today' }),
      });
    }
  }
  return { reminded, digests };
}

/**
 * The `pipeline:stale` task (hourly). Each rule reminds once per Kathmandu day while it holds; the
 * thresholds are `pipeline.*` settings.
 * - contacted_quiet: CONTACTED, no activity for `contactedQuietDays` (3)
 * - visit_no_survey: the inspection day has passed and the survey is not in
 * - survey_unquoted: a survey submitted `surveyUnquotedHours` (48) ago has no quotation
 * - approval_waiting: a quotation waiting `approvalWaitingHours` (24) for approval → the approvers
 * - quote_unanswered: sent `quoteUnansweredDays` (3) ago, no answer, still valid
 * - quote_expiring: sent, lapses within `quoteExpiringDays` (2)
 * @param {Date} [now]
 */
export async function runStaleSweep(now = new Date()) {
  managersCache = null;
  const day = ktmDay(now);
  const [quietDays, unquotedHours, approvalHours, unansweredDays, expiringDays] = await Promise.all([
    setting('pipeline.contactedQuietDays', 3),
    setting('pipeline.surveyUnquotedHours', 48),
    setting('pipeline.approvalWaitingHours', 24),
    setting('pipeline.quoteUnansweredDays', 3),
    setting('pipeline.quoteExpiringDays', 2),
  ]);
  const sent = {};
  const count = (rule, n) => { sent[rule] = (sent[rule] ?? 0) + n; };

  const quietSince = addDays(now, -quietDays);
  const quiet = await prisma.lead.findMany({
    where: { deletedAt: null, status: 'CONTACTED', stageEnteredAt: { lt: quietSince }, activities: { none: { createdAt: { gte: quietSince } } } },
    select: { id: true, name: true, assignedToId: true },
    take: 200,
  });
  for (const lead of quiet) {
    count('contacted_quiet', await remindOnce(await ownerOr([lead.assignedToId]), `stale:contacted_quiet:${lead.id}:${day}`, {
      type: 'pipeline_contacted_quiet',
      title: `${lead.name} has gone quiet`,
      body: `Contacted, and nothing logged for ${quietDays} days. Call, book the visit, or close it.`,
      link: adminLeadPath(lead.id),
    }));
  }

  const visits = await prisma.job.findMany({
    where: {
      deletedAt: null, type: 'INSPECTION', status: { not: 'CANCELLED' }, lead: { deletedAt: null, status: OPEN },
      scheduledStart: { lt: startOfDay(now), gt: addDays(now, -30) },
      OR: [{ survey: null }, { survey: { status: { in: ['DRAFT', 'RETURNED'] } } }],
    },
    select: { id: true, number: true, leadId: true, lead: { select: { name: true, assignedToId: true } } },
    take: 200,
  });
  for (const job of visits) {
    count('visit_no_survey', await remindOnce(await ownerOr([job.lead.assignedToId]), `stale:visit_no_survey:${job.id}:${day}`, {
      type: 'pipeline_visit_no_survey',
      title: `No survey yet from the visit to ${job.lead.name}`,
      body: `Visit ${job.number} has passed and its survey is not submitted.`,
      link: adminLeadPath(job.leadId),
    }));
  }

  const surveys = await prisma.siteSurvey.findMany({
    where: {
      deletedAt: null, status: { in: ['SUBMITTED', 'IN_REVIEW'] }, quotationId: null,
      submittedAt: { lt: addMinutes(now, -unquotedHours * HOUR) },
    },
    select: { id: true, number: true, customer: { select: { name: true } }, lead: { select: { assignedToId: true } } },
    take: 200,
  });
  for (const survey of surveys) {
    count('survey_unquoted', await remindOnce(await ownerOr([survey.lead?.assignedToId]), `stale:survey_unquoted:${survey.id}:${day}`, {
      type: 'pipeline_survey_unquoted',
      title: `Survey ${survey.number} is waiting for a quotation`,
      body: `${survey.customer.name}'s survey came in over ${unquotedHours} hours ago.`,
      link: adminSurveyPath(survey.id),
    }));
  }

  const waiting = await prisma.quotation.findMany({
    where: { deletedAt: null, status: 'PENDING_APPROVAL', submittedAt: { lt: addMinutes(now, -approvalHours * HOUR) } },
    select: { id: true, number: true, version: true, createdById: true, customer: { select: { name: true } } },
    take: 200,
  });
  if (waiting.length) {
    const approvers = await userIdsWithRoles(APPROVER_ROLES);
    for (const q of waiting) {
      count('approval_waiting', await remindOnce(approvers.filter((id) => id !== q.createdById), `stale:approval_waiting:${q.id}:${day}`, {
        type: 'pipeline_approval_waiting',
        title: `${q.number} v${q.version} has waited over ${approvalHours} hours for approval`,
        body: `${q.customer.name} is waiting on this quotation.`,
        link: adminQuotationPath(q.id),
      }));
    }
  }

  const sentOpen = { deletedAt: null, status: 'SENT' };
  const select = { id: true, number: true, version: true, validUntil: true, createdById: true, customer: { select: { name: true } }, lead: { select: { assignedToId: true } } };
  const [unanswered, expiring] = await Promise.all([
    prisma.quotation.findMany({
      where: { ...sentOpen, sentAt: { lt: addDays(now, -unansweredDays) }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      select, take: 200,
    }),
    prisma.quotation.findMany({ where: { ...sentOpen, validUntil: { gt: now, lte: addDays(now, expiringDays) } }, select, take: 200 }),
  ]);
  for (const q of unanswered) {
    count('quote_unanswered', await remindOnce(await ownerOr([q.lead?.assignedToId, q.createdById]), `stale:quote_unanswered:${q.id}:${day}`, {
      type: 'pipeline_quote_unanswered',
      title: `${q.customer.name} has not answered ${q.number} v${q.version}`,
      body: `Sent over ${unansweredDays} days ago. Call to ask what is holding them back.`,
      link: adminQuotationPath(q.id),
    }));
  }
  for (const q of expiring) {
    count('quote_expiring', await remindOnce(await ownerOr([q.lead?.assignedToId, q.createdById]), `stale:quote_expiring:${q.id}:${day}`, {
      type: 'pipeline_quote_expiring',
      title: `${q.number} v${q.version} for ${q.customer.name} expires soon`,
      body: `Valid until ${ktmDay(q.validUntil)}. Chase the answer, or revise it before it lapses.`,
      link: adminQuotationPath(q.id),
    }));
  }
  return sent;
}
