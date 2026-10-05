import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, notFound } from '../utils/AppError.js';
import { addDays, customerDate, dayjs, local } from '../utils/dates.js';
import { normalizePhone } from '../utils/phone.js';
import { publicToken } from '../utils/tokens.js';
import { adminJobPath, webUrl } from '../utils/links.js';
import { getSetting } from './settings.service.js';
import { notify, notifyUsers, userIdsWithRoles } from './notify.service.js';
import { recordEvent } from './audit.service.js';

/**
 * The site visit as the customer sees it (Phase L5). A booked INSPECTION job sends `visit_booked` — the
 * window, the surveyor's name and phone, and a `/visit/:token` link — to the customer and to the site
 * contact (the caretaker while the owner is abroad). On that page, with no login, they Confirm or ask for
 * another time; the latest answer wins and a new window clears it. At 17:00 the day before, `visits:remind`
 * sends the reminder once.
 */

/** A visit can be answered until the surveyor sets off and while its window is still ahead. */
const ANSWERABLE = ['DRAFT', 'SCHEDULED', 'ASSIGNED'];
/** The reminder skips a visit that is under way or over, and one the customer asked to move. */
const REMINDABLE = ANSWERABLE;

const VISIT_SELECT = {
  id: true, number: true, type: true, status: true, scheduledStart: true, scheduledEnd: true, deletedAt: true,
  visitToken: true, visitAnswer: true, visitAnswerNote: true, visitAnsweredAt: true, customerConfirmedAt: true,
  leadId: true,
  customer: { select: { id: true, name: true, phone: true, preferredLocale: true } },
  site: { select: { id: true, label: true, address: true, area: true, landmark: true, contactName: true, contactPhone: true } },
  lead: { select: { id: true, name: true, assignedToId: true } },
  assignments: {
    orderBy: { isLead: 'desc' },
    select: { isLead: true, technician: { select: { user: { select: { name: true, phone: true } } } } },
  },
};

const SURVEYOR_WORDS = { en: 'our surveyor', ne: 'हाम्रो सर्वेक्षक' };

/** The surveyor going — the lead technician on the job — or null while nobody is assigned. */
const surveyorOf = (job) => {
  const user = job.assignments?.[0]?.technician?.user;
  return user ? { name: user.name, phone: user.phone ?? null } : null;
};

/** "10:00–12:00", or "from 10:00" without an end — Kathmandu time. */
export function visitWindowText(start, end) {
  if (!start) return null;
  return end ? `${local(start, 'HH:mm')}–${local(end, 'HH:mm')}` : local(start, 'HH:mm');
}

/** The visit's public page. */
export const visitLink = (token) => webUrl(`/visit/${token}`);

async function company() {
  const [name, phone] = await Promise.all([getSetting('contact.companyName', null), getSetting('contact.phonePrimary', null)]);
  return { name: name ?? env.appName, phone: phone ?? null };
}

/** The job's visit token, minted once (an inspection created before Phase L5 has none). */
async function ensureVisitToken(job) {
  if (job.visitToken) return job.visitToken;
  const token = publicToken();
  const { count } = await prisma.job.updateMany({ where: { id: job.id, visitToken: null }, data: { visitToken: token } });
  if (count) return token;
  return (await prisma.job.findUnique({ where: { id: job.id }, select: { visitToken: true } })).visitToken;
}

/**
 * Who hears about the visit: the customer, and the site contact when that is another number. Each in
 * the customer's language — the one the booking was made in.
 */
function recipients(job) {
  const out = [];
  if (job.customer?.phone) out.push({ to: job.customer.phone, name: job.customer.name });
  const contact = job.site?.contactPhone;
  if (contact && normalizePhone(contact) !== normalizePhone(job.customer?.phone)) {
    out.push({ to: contact, name: job.site.contactName || job.customer?.name });
  }
  return out;
}

const FALLBACK = {
  visit_booked: 'Hi {{name}}, your site visit {{number}} is booked for {{date}}, {{window}}. {{surveyor}} will come. '
    + 'Confirm or ask for another time: {{link}} - {{appName}}',
  visit_reminder: 'Hi {{name}}, reminder: {{surveyor}} visits tomorrow, {{date}}, {{window}} ({{number}}). '
    + 'Confirm or ask for another time: {{link}} - {{appName}}',
};

async function sendVisitSms(job, templateKey) {
  const token = await ensureVisitToken(job);
  const locale = job.customer?.preferredLocale === 'ne' ? 'ne' : 'en';
  const who = surveyorOf(job);
  const surveyor = who ? `${who.name}${who.phone ? ` (${who.phone})` : ''}` : SURVEYOR_WORDS[locale];
  let sent = 0;
  for (const r of recipients(job)) {
    const log = await notify({
      templateKey, channel: 'sms', to: r.to, locale,
      vars: {
        name: r.name, customerName: job.customer?.name, number: job.number, surveyor,
        date: customerDate(job.scheduledStart, locale), window: visitWindowText(job.scheduledStart, job.scheduledEnd),
        link: visitLink(token), appName: env.appName,
      },
      related: { model: 'Job', id: job.id },
      fallbackBody: FALLBACK[templateKey],
    });
    if (log) sent += 1;
  }
  return sent;
}

/**
 * `visit_booked` for an INSPECTION job with a window — after its booking or a new window has committed.
 * A job that is not an inspection, or has no start, sends nothing.
 * @returns {Promise<number>} messages sent
 */
export async function announceVisit(jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, deletedAt: null }, select: VISIT_SELECT });
  if (!job || job.type !== 'INSPECTION' || !job.scheduledStart) return 0;
  return sendVisitSms(job, 'visit_booked');
}

/** The fields a new window resets on an inspection job: the customer answers the new one. */
export const VISIT_ANSWER_RESET = Object.freeze({
  visitAnswer: null, visitAnswerNote: null, visitAnsweredAt: null, visitAnswerIp: null,
  customerConfirmedAt: null, visitReminderSentAt: null,
});

const closedFor = (job, now) => !ANSWERABLE.includes(job.status) || !job.scheduledStart
  || (job.scheduledEnd ?? job.scheduledStart) <= now;

async function findByToken(token) {
  const job = await prisma.job.findFirst({ where: { visitToken: token, deletedAt: null, type: 'INSPECTION' }, select: VISIT_SELECT });
  if (!job) throw notFound('Visit');
  return job;
}

/** What the /visit/:token page shows. No money, no internal notes. */
async function publicShape(job, now = new Date()) {
  return {
    number: job.number,
    status: job.status,
    window: { start: job.scheduledStart, end: job.scheduledEnd },
    site: job.site ? { label: job.site.label, address: job.site.address, area: job.site.area, landmark: job.site.landmark } : null,
    surveyor: surveyorOf(job),
    customer: { name: job.customer?.name, preferredLocale: job.customer?.preferredLocale ?? 'en' },
    answer: job.visitAnswer,
    answerNote: job.visitAnswerNote,
    answeredAt: job.visitAnsweredAt,
    canAnswer: !closedFor(job, now),
    company: await company(),
  };
}

/** GET /public/visits/:token */
export async function getVisitByToken(token) {
  return publicShape(await findByToken(token));
}

/**
 * POST /public/visits/:token/respond — Confirm, or Need another time. The latest answer wins; the same
 * answer again changes nothing. "Need another time" tells the lead's salesperson and the dispatchers.
 * A visit already under way, over, or cancelled answers 422 VISIT_CLOSED.
 */
export async function respondToVisit(token, { answer, note }, { ip } = {}) {
  const job = await findByToken(token);
  const now = new Date();
  if (closedFor(job, now)) {
    throw new AppError(422, 'VISIT_CLOSED', 'This visit can no longer be changed here. Please call us.');
  }
  const value = answer === 'confirm' ? 'CONFIRMED' : 'RESCHEDULE_REQUESTED';
  const text = note?.trim() || null;
  if (job.visitAnswer === value && (value === 'CONFIRMED' || job.visitAnswerNote === text)) return publicShape(job, now);

  const data = {
    visitAnswer: value, visitAnswerNote: text, visitAnsweredAt: now, visitAnswerIp: ip ?? null,
    customerConfirmedAt: value === 'CONFIRMED' ? now : null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: job.id }, data });
    await recordEvent(value === 'CONFIRMED' ? 'visit.confirmed' : 'visit.reschedule_requested', {
      model: 'Job', recordId: job.id,
      before: { visitAnswer: job.visitAnswer }, after: { visitAnswer: value },
      meta: { note: text, ip: ip ?? null },
    }, tx);
    if (job.leadId) {
      await tx.leadActivity.create({
        data: {
          leadId: job.leadId, type: 'note',
          summary: value === 'CONFIRMED'
            ? `Customer confirmed visit ${job.number}`
            : `Customer asked for another time for visit ${job.number}${text ? `: "${text}"` : ''}`,
        },
      });
    }
  });

  if (value === 'RESCHEDULE_REQUESTED') {
    const dispatchers = await userIdsWithRoles(['DISPATCHER']);
    await notifyUsers([{ userId: job.lead?.assignedToId }, ...dispatchers.map((userId) => ({ userId }))], {
      type: 'visit_reschedule_requested',
      title: `${job.customer?.name ?? 'The customer'} needs another time for ${job.number}`,
      body: `${local(job.scheduledStart, 'D MMM HH:mm')}${text ? ` · "${text}"` : ''}`,
      link: adminJobPath(job.id),
    });
  }
  return publicShape({ ...job, ...data }, now);
}

/**
 * The `visits:remind` task: from `visits.reminderHour` (17:00) Kathmandu time, each INSPECTION visit
 * tomorrow gets `visit_reminder` — to the customer and the site contact — **once**: the job's
 * `visitReminderSentAt` is claimed compare-and-swap before sending, so a second run, or a second instance,
 * sends nothing. A new window clears it, so a moved visit is reminded for its new day. A visit the customer
 * asked to move is not reminded of.
 * @param {Date} [now]
 * @returns {Promise<{ visits: number, messages: number }>}
 */
export async function runVisitReminders(now = new Date()) {
  const tz = env.business.timezone;
  const hour = Number(await getSetting('visits.reminderHour', 17));
  if (Number(dayjs(now).tz(tz).format('H')) < hour) return { visits: 0, messages: 0 };

  const tomorrow = dayjs(addDays(now, 1)).tz(tz);
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null, type: 'INSPECTION', status: { in: REMINDABLE }, visitReminderSentAt: null,
      scheduledStart: { gte: tomorrow.startOf('day').toDate(), lte: tomorrow.endOf('day').toDate() },
      OR: [{ visitAnswer: null }, { visitAnswer: 'CONFIRMED' }],
    },
    select: VISIT_SELECT,
    orderBy: { scheduledStart: 'asc' },
    take: 500,
  });

  let visits = 0;
  let messages = 0;
  for (const job of jobs) {
    const { count } = await prisma.job.updateMany({ where: { id: job.id, visitReminderSentAt: null }, data: { visitReminderSentAt: now } });
    if (!count) continue;
    visits += 1;
    messages += await sendVisitSms(job, 'visit_reminder');
  }
  return { visits, messages };
}
