import { prisma } from '../lib/prisma.js';
import { can } from '../shared/permissions.js';
import { outstanding } from '../utils/money.js';
import { addDays, kathmanduDayRange, local, startOfDay } from '../utils/dates.js';

/**
 * The SLA board's calendar: every dated thing still waiting on the office — a new enquiry's reply deadline, a
 * lead's next action, a site visit, a job, a quotation running out, an invoice falling due, an AMC visit or
 * renewal — for a span of Kathmandu days, plus whatever is already late wherever it falls, so nothing overdue
 * hides before the first day on screen. A kind is read only by a role that may read its records; the others
 * are left out of the answer, not refused.
 */

const OPEN_LEAD = { notIn: ['WON', 'LOST'] };
/** A job still to happen or under way. */
const OPEN_JOB = ['DRAFT', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'];
/** A quotation still in play: approved to send, with the customer, or sent back for changes. */
const LIVE_QUOTE = ['OFFICE_APPROVED', 'SENT', 'CHANGES_REQUESTED'];
const UNPAID = ['SENT', 'PARTIAL', 'OVERDUE'];

/** The most rows one kind brings back for the span, and again for its late ones; a kind cut short is named in `truncated`. */
export const AGENDA_KIND_LIMIT = 300;
/** The widest span one request may ask for — a six-week month grid fits. */
export const AGENDA_MAX_DAYS = 62;

const NAME = { select: { id: true, name: true } };
const JOB_SELECT = {
  id: true, number: true, title: true, status: true, priority: true, scheduledStart: true, scheduledEnd: true,
  customer: { select: { name: true } },
  site: { select: { area: true } },
  lead: { select: { assignedTo: NAME } },
  assignments: { orderBy: { isLead: 'desc' }, select: { technician: { select: { user: { select: { name: true } } } } } },
};

/** A timed thing is late once its moment has passed; a dated one once its Kathmandu day is over. */
const lateBefore = (allDay, now) => (allDay ? startOfDay(now) : now);

/** A job or visit is late when its window has closed (its start, without an end) and it is still open. */
const jobLate = (now) => ({ OR: [{ scheduledEnd: { lt: now } }, { scheduledEnd: null, scheduledStart: { lt: now } }] });
const jobIsLate = (j, now) => (j.scheduledEnd ?? j.scheduledStart) < now;

const jobItem = (j) => ({
  id: j.id,
  at: j.scheduledStart,
  endAt: j.scheduledEnd,
  title: j.customer?.name ?? j.title,
  detail: [j.title, j.site?.area].filter(Boolean).join(' · '),
  number: j.number,
  href: `/admin/jobs/${j.id}`,
  owner: j.lead?.assignedTo ?? null,
  people: j.assignments.map((a) => a.technician.user.name),
  priority: j.priority,
  status: j.status,
});

/**
 * Each kind: who may read it, the rows still waiting (`where`), the date it sits on (`field`), whether that date is
 * a day rather than a moment (`allDay`), and how a row reads on the calendar (`item`). `ownable` kinds belong to a
 * salesperson — the board's Mine / Unassigned switch narrows them.
 */
const SOURCES = [
  {
    kind: 'response',
    capability: 'leads:read',
    model: 'lead',
    field: 'slaDueAt',
    ownable: true,
    where: { deletedAt: null, firstResponseAt: null, slaDueAt: { not: null }, status: OPEN_LEAD },
    select: {
      id: true, name: true, area: true, phone: true, priority: true, status: true, slaDueAt: true,
      assignedTo: NAME, service: { select: { name: true } },
    },
    item: (l) => ({
      id: l.id, at: l.slaDueAt, title: l.name, detail: [l.service?.name ?? 'General enquiry', l.area].filter(Boolean).join(' · '),
      href: `/admin/leads/${l.id}`, owner: l.assignedTo, priority: l.priority, status: l.status, phone: l.phone,
    }),
  },
  {
    kind: 'followUp',
    capability: 'leads:read',
    model: 'lead',
    field: 'nextActionAt',
    ownable: true,
    where: { deletedAt: null, status: OPEN_LEAD, nextActionAt: { not: null } },
    select: {
      id: true, name: true, area: true, phone: true, priority: true, status: true,
      nextActionAt: true, nextActionType: true, nextActionNote: true,
      assignedTo: NAME, service: { select: { name: true } },
    },
    item: (l) => ({
      id: l.id, at: l.nextActionAt, title: l.name, detail: [l.service?.name ?? 'General enquiry', l.area].filter(Boolean).join(' · '),
      href: `/admin/leads/${l.id}`, owner: l.assignedTo, priority: l.priority, status: l.status, phone: l.phone,
      type: l.nextActionType, note: l.nextActionNote,
    }),
  },
  {
    kind: 'visit',
    capability: 'jobs:read',
    model: 'job',
    field: 'scheduledStart',
    ownable: true,
    where: { deletedAt: null, type: 'INSPECTION', status: { in: OPEN_JOB }, scheduledStart: { not: null } },
    late: jobLate,
    isLate: jobIsLate,
    select: JOB_SELECT,
    item: jobItem,
  },
  {
    kind: 'job',
    capability: 'jobs:read',
    model: 'job',
    field: 'scheduledStart',
    where: { deletedAt: null, type: { not: 'INSPECTION' }, status: { in: OPEN_JOB }, scheduledStart: { not: null } },
    late: jobLate,
    isLate: jobIsLate,
    select: JOB_SELECT,
    item: jobItem,
  },
  {
    kind: 'quotation',
    capability: 'quotations:read',
    model: 'quotation',
    field: 'validUntil',
    allDay: true,
    ownable: true,
    where: { deletedAt: null, status: { in: LIVE_QUOTE }, validUntil: { not: null } },
    select: {
      id: true, number: true, status: true, validUntil: true, total: true,
      customer: { select: { name: true } }, lead: { select: { assignedTo: NAME } }, createdBy: NAME,
    },
    item: (q) => ({
      id: q.id, at: q.validUntil, title: q.customer?.name ?? q.number, detail: q.number, number: q.number,
      href: `/admin/quotations/${q.id}`, owner: q.lead?.assignedTo ?? q.createdBy ?? null, status: q.status, amount: q.total,
    }),
  },
  {
    kind: 'invoice',
    capability: 'invoices:read',
    model: 'invoice',
    field: 'dueDate',
    allDay: true,
    where: { deletedAt: null, status: { in: UNPAID }, dueDate: { not: null } },
    select: {
      id: true, number: true, kind: true, status: true, dueDate: true, total: true, paidAmount: true,
      customer: { select: { name: true } },
    },
    item: (inv) => ({
      id: inv.id, at: inv.dueDate, title: inv.customer?.name ?? inv.number, detail: inv.number, number: inv.number,
      href: `/admin/invoices/${inv.id}`, status: inv.status, type: inv.kind, amount: outstanding(inv.total, inv.paidAmount),
    }),
  },
  {
    kind: 'amcVisit',
    capability: 'amc:read',
    model: 'amcVisit',
    field: 'dueDate',
    allDay: true,
    where: { status: 'pending', contract: { deletedAt: null, status: 'active' } },
    select: {
      id: true, dueDate: true, status: true,
      contract: { select: { id: true, number: true, planName: true, customer: { select: { name: true } }, site: { select: { area: true } } } },
    },
    item: (v) => ({
      id: v.id, at: v.dueDate, title: v.contract.customer?.name ?? v.contract.number,
      detail: [v.contract.planName, v.contract.site?.area].filter(Boolean).join(' · '), number: v.contract.number,
      href: `/admin/amc-contracts/${v.contract.id}`, status: v.status,
    }),
  },
  {
    kind: 'renewal',
    capability: 'amc:read',
    model: 'amcContract',
    field: 'endDate',
    allDay: true,
    where: { deletedAt: null, status: 'active' },
    select: { id: true, number: true, planName: true, endDate: true, amount: true, customer: { select: { name: true } } },
    item: (c) => ({
      id: c.id, at: c.endDate, title: c.customer?.name ?? c.number, detail: c.planName, number: c.number,
      href: `/admin/amc-contracts/${c.id}`, amount: c.amount,
    }),
  },
];

/** The kinds a role reads on the calendar, in the order the legend lists them. */
export const agendaKindsFor = (role) => SOURCES.filter((s) => can(role, s.capability)).map((s) => s.kind);

/** `{ from, to }` as Kathmandu days, defaulting to this week; at most AGENDA_MAX_DAYS. */
export function agendaSpan({ from, to } = {}, now = new Date()) {
  const start = from ?? local(now, 'YYYY-MM-DD');
  const end = to ?? local(addDays(new Date(`${start}T12:00:00Z`), 6), 'YYYY-MM-DD');
  return { from: start, to: end };
}

/**
 * One kind's rows: those in `range`, and the late ones wherever they fall — each with its own limit, so a backlog
 * of late follow-ups never pushes the span's own rows out — and how many are late in all.
 *
 * @param {object} source  an entry of SOURCES
 * @param {{ gte: Date, lte: Date }} range
 * @param {Date} now
 */
async function readSource(source, range, now) {
  const { model, field, allDay = false } = source;
  const late = source.late ? source.late(now) : { [field]: { lt: lateBefore(allDay, now) } };
  const delegate = prisma[model];
  const find = (where) => delegate.findMany({
    where: { AND: [source.where, where] }, select: source.select, orderBy: { [field]: 'asc' }, take: AGENDA_KIND_LIMIT + 1,
  });
  const [inSpan, lateRows, lateCount] = await Promise.all([
    find({ [field]: range }),
    find(late),
    delegate.count({ where: { AND: [source.where, late] } }),
  ]);
  const truncated = inSpan.length > AGENDA_KIND_LIMIT || lateRows.length > AGENDA_KIND_LIMIT;
  const rows = new Map();
  for (const row of [...inSpan.slice(0, AGENDA_KIND_LIMIT), ...lateRows.slice(0, AGENDA_KIND_LIMIT)]) rows.set(row.id, row);
  return { rows: [...rows.values()], lateCount, truncated };
}

/**
 * Where a thing stands now: `overdue` once late, `today` when it falls on Kathmandu's today or has started and is
 * not yet late (a job under way), else `upcoming`.
 */
function stateOf(source, row, at, now) {
  const allDay = Boolean(source.allDay);
  const isLate = source.isLate ? source.isLate(row, now) : at < lateBefore(allDay, now);
  if (isLate) return 'overdue';
  if (local(at, 'YYYY-MM-DD') === local(now, 'YYYY-MM-DD') || at <= now) return 'today';
  return 'upcoming';
}

/**
 * GET /admin/agenda — the calendar's items for `from`–`to` (Kathmandu days, inclusive) and every overdue one,
 * oldest first; `overdue` counts what is late per kind (all of it, past the per-kind limit).
 *
 * @param {{ from?: string, to?: string }} query
 * @param {{ role: string }} user
 */
export async function agenda(query, user, now = new Date()) {
  const { from, to } = agendaSpan(query, now);
  const range = kathmanduDayRange(from, to);
  const sources = SOURCES.filter((s) => can(user.role, s.capability));
  const read = await Promise.all(sources.map((s) => readSource(s, range, now)));

  const items = [];
  const byKind = {};
  const truncated = [];
  sources.forEach((source, i) => {
    const { rows, lateCount, truncated: cut } = read[i];
    byKind[source.kind] = lateCount;
    if (cut) truncated.push(source.kind);
    for (const row of rows) {
      const { owner, ...rest } = source.item(row);
      items.push({
        key: `${source.kind}:${rest.id}`,
        kind: source.kind,
        allDay: Boolean(source.allDay),
        ownable: Boolean(source.ownable),
        endAt: null,
        ...rest,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        state: stateOf(source, row, rest.at, now),
      });
    }
  });
  items.sort((a, b) => new Date(a.at) - new Date(b.at) || a.kind.localeCompare(b.kind));

  return {
    from, to,
    kinds: sources.map((s) => s.kind),
    items,
    overdue: { total: Object.values(byKind).reduce((n, c) => n + c, 0), byKind },
    truncated,
  };
}
