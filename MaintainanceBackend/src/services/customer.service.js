import { prisma } from '../lib/prisma.js';
import { notFound, badRequest, unprocessable } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { normalizePhone } from '../utils/phone.js';
import { formatNpr, sum } from '../utils/money.js';
import { addDays } from '../utils/dates.js';

const OPEN_JOB = { deletedAt: null, status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] } };
const UNPAID = ['SENT', 'PARTIAL', 'OVERDUE'];

/**
 * Customers, with site and open-job counts. `balanceDue` (paisa: invoiced minus paid on
 * unpaid invoices) is added only when the caller may see money — the route decides.
 *
 * @param {object} query  validated customerListQuery
 * @param {{ withBalance?: boolean }} [opts]
 */
export async function listCustomers(query, { withBalance = false } = {}) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const where = {
    deletedAt: null,
    ...(query.type ? { type: query.type } : {}),
    ...(query.tag ? { tags: { array_contains: [query.tag] } } : {}),
    ...(query.hasOpenJobs ? { jobs: { some: OPEN_JOB } } : {}),
    ...(query.owing && withBalance ? { invoices: { some: { deletedAt: null, status: { in: UNPAID } } } } : {}),
    ...(q ? { OR: searchOr(q, ['name', 'phone', 'altPhone', 'email', 'panVatNo']) } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where, orderBy, skip, take,
      include: {
        sites: { where: { deletedAt: null }, select: { id: true, label: true, address: true, isPrimary: true } },
        _count: { select: { jobs: { where: OPEN_JOB }, invoices: true, quotations: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  let balances = new Map();
  if (withBalance && rows.length) {
    const grouped = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: { customerId: { in: rows.map((c) => c.id) }, deletedAt: null, status: { in: UNPAID } },
      _sum: { total: true, paidAmount: true },
    });
    balances = new Map(grouped.map((g) => [g.customerId, (g._sum.total ?? 0) - (g._sum.paidAmount ?? 0)]));
  }

  const items = rows.map(({ _count, ...c }) => ({
    ...c,
    siteCount: c.sites.length,
    openJobs: _count.jobs,
    invoiceCount: _count.invoices,
    quotationCount: _count.quotations,
    ...(withBalance ? { balanceDue: balances.get(c.id) ?? 0 } : {}),
  }));
  return { items, meta: meta({ page, limit, total }) };
}

/**
 * The customer book at a glance, for the list's header: how many, how many companies, who
 * has work on now, and who joined in the last 30 days. With `withBalance` (the route decides,
 * as for the list) also how many owe money and how much in total, in paisa.
 *
 * @param {{ withBalance?: boolean }} [opts]
 */
export async function customerSummary({ withBalance = false } = {}) {
  const live = { deletedAt: null };
  const unpaid = { deletedAt: null, status: { in: UNPAID }, customer: live };
  const [total, companies, withOpenJobs, newLast30Days, owingCount, owed] = await Promise.all([
    prisma.customer.count({ where: live }),
    prisma.customer.count({ where: { ...live, type: 'company' } }),
    prisma.customer.count({ where: { ...live, jobs: { some: OPEN_JOB } } }),
    prisma.customer.count({ where: { ...live, createdAt: { gte: addDays(new Date(), -30) } } }),
    withBalance ? prisma.customer.count({ where: { ...live, invoices: { some: { deletedAt: null, status: { in: UNPAID } } } } }) : null,
    withBalance ? prisma.invoice.aggregate({ where: unpaid, _sum: { total: true, paidAmount: true } }) : null,
  ]);
  return {
    total, companies, withOpenJobs, newLast30Days,
    ...(withBalance ? { owingCount, owed: sum([owed._sum.total]) - sum([owed._sum.paidAmount]) } : {}),
  };
}

export async function getCustomer(id) {
  const c = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      sites: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      contracts: { where: { deletedAt: null }, orderBy: { endDate: 'desc' } },
      _count: { select: { jobs: true, invoices: true, quotations: true, leads: true, warranties: true } },
    },
  });
  if (!c) throw notFound('Customer');
  return c;
}

/**
 * A new customer. The same phone as an existing customer is allowed on purpose —
 * phones are shared by families and tenants — so the screen warns, the API does not refuse.
 */
export async function createCustomer(data) {
  return prisma.customer.create({ data: { ...data, phone: normalizePhone(data.phone) } });
}

/** A staff edit. An email change here is the audited model change (before → after). */
export async function updateCustomer(id, data) {
  await getCustomer(id);
  return prisma.customer.update({
    where: { id },
    data: { ...data, ...(data.phone ? { phone: normalizePhone(data.phone) } : {}) },
  });
}

export async function deleteCustomer(id) {
  await getCustomer(id);
  const open = await prisma.job.count({ where: { customerId: id, ...OPEN_JOB } });
  if (open) throw badRequest(`This customer has ${open} open job(s). Close them first.`);
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * Live customers with any of these phone numbers, described so staff can tell whether
 * the enquiry is the same person: jobs, and the last visit (the latest job that started
 * or was scheduled).
 *
 * @param {string[]} phones
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 */
export async function customersWithPhone(phones, client = prisma) {
  const normalized = [...new Set(phones.map(normalizePhone))];
  if (!normalized.length) return [];
  const rows = await client.customer.findMany({
    where: { deletedAt: null, OR: [{ phone: { in: normalized } }, { altPhone: { in: normalized } }] },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: {
      id: true, name: true, phone: true, altPhone: true, email: true, type: true, preferredLocale: true, createdAt: true,
      _count: { select: { jobs: { where: { deletedAt: null } } } },
      jobs: {
        where: { deletedAt: null, OR: [{ actualStart: { not: null } }, { scheduledStart: { not: null } }] },
        orderBy: [{ actualStart: { sort: 'desc', nulls: 'last' } }, { scheduledStart: 'desc' }],
        take: 1,
        select: { actualStart: true, scheduledStart: true },
      },
      sites: { where: { deletedAt: null, isPrimary: true }, take: 1, select: { address: true } },
    },
  });
  return rows.map(({ _count, jobs, sites, ...c }) => ({
    ...c,
    jobCount: _count.jobs,
    lastVisitAt: jobs[0] ? jobs[0].actualStart ?? jobs[0].scheduledStart : null,
    primaryAddress: sites[0]?.address ?? null,
  }));
}

const sameAddress = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * The site a convert's visit or quotation belongs to, inside its transaction.
 *
 * - An address staff typed (`explicit`) is used as given: an existing site with that
 *   address, or a new one — primary only when the customer has none yet.
 * - Otherwise the primary site, or — for a customer with no site — one made from the
 *   lead's address, when it has one.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} customerId
 * @param {{ label?: string, address?: string|null, area?: string|null, explicit: boolean }} site
 */
export async function siteForConvert(tx, customerId, { label, address, area, explicit }) {
  const sites = await tx.customerSite.findMany({
    where: { customerId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  const primary = sites.find((s) => s.isPrimary) ?? null;

  if (explicit && address) {
    const existing = sites.find((s) => sameAddress(s.address, address));
    if (existing) return existing;
  } else if (primary || !address) {
    return primary;
  }
  return tx.customerSite.create({
    data: {
      customerId,
      label: label || (primary ? 'Other site' : 'Primary site'),
      address,
      area: area ?? null,
      isPrimary: !primary,
    },
  });
}

export async function listSites(customerId) {
  await getCustomer(customerId);
  return prisma.customerSite.findMany({
    where: { customerId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
}

async function findSite(customerId, siteId, client = prisma) {
  const site = await client.customerSite.findFirst({ where: { id: siteId, customerId, deletedAt: null } });
  if (!site) throw notFound('Site');
  return site;
}

/** Marks one site primary and every other site of the customer not, through `tx`. */
async function makePrimary(tx, customerId, siteId) {
  await tx.customerSite.updateMany({
    where: { customerId, id: { not: siteId }, isPrimary: true },
    data: { isPrimary: false },
  });
}

/**
 * A customer has exactly one primary site once it has any: the first site is primary
 * whatever the form said, and a site marked primary takes the flag from the others.
 */
export async function createSite(customerId, data) {
  await getCustomer(customerId);
  return prisma.$transaction(async (tx) => {
    const hasPrimary = await tx.customerSite.count({ where: { customerId, deletedAt: null, isPrimary: true } });
    const isPrimary = Boolean(data.isPrimary) || hasPrimary === 0;
    const site = await tx.customerSite.create({ data: { ...data, customerId, isPrimary } });
    if (isPrimary) await makePrimary(tx, customerId, site.id);
    return site;
  });
}

/** Unmarking the primary is refused: mark another site primary instead. */
export async function updateSite(customerId, siteId, data) {
  const site = await findSite(customerId, siteId);
  if (site.isPrimary && data.isPrimary === false) {
    throw unprocessable('Every customer keeps one primary site. Mark another site as primary instead.');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customerSite.update({ where: { id: siteId }, data });
    if (data.isPrimary) await makePrimary(tx, customerId, siteId);
    return updated;
  });
}

/** A site with jobs stays. Removing the primary passes the flag to the oldest other site. */
export async function deleteSite(customerId, siteId) {
  const site = await findSite(customerId, siteId);
  const jobs = await prisma.job.count({ where: { siteId, deletedAt: null } });
  if (jobs) throw badRequest(`This site has ${jobs} job(s) linked and cannot be removed`);
  await prisma.$transaction(async (tx) => {
    await tx.customerSite.update({ where: { id: siteId }, data: { deletedAt: new Date(), isPrimary: false } });
    if (site.isPrimary) {
      const next = await tx.customerSite.findFirst({
        where: { customerId, deletedAt: null }, orderBy: { createdAt: 'asc' },
      });
      if (next) await tx.customerSite.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
}

/** Everything that ever happened with this customer, newest first. */
/** How the timeline words a decided quotation. */
const CUSTOMER_ANSWER = {
  APPROVED: 'accepted', CONVERTED: 'accepted', CHANGES_REQUESTED: 'asked for changes to', REJECTED: 'declined',
};

/**
 * A superseded version keeps its answer: the revision that replaced it carries the
 * change request, so a revision with none answered a decline (or an unanswered send).
 */
function customerAnswer(q, byId) {
  if (q.status !== 'SUPERSEDED') return CUSTOMER_ANSWER[q.status];
  return byId.get(q.supersededById)?.requestedChanges ? 'asked for changes to' : 'declined';
}

export async function customerTimeline(id) {
  await getCustomer(id);
  const [leads, quotations, jobs, invoices, warranties] = await Promise.all([
    prisma.lead.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.quotation.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.job.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.warranty.findMany({ where: { customerId: id }, orderBy: { endsAt: 'desc' } }),
  ]);
  const byId = new Map(quotations.map((r) => [r.id, r]));
  const entries = [
    ...leads.map((r) => ({ kind: 'lead', at: r.createdAt, id: r.id, label: `Enquiry — ${r.status}`, meta: r })),
    ...quotations.map((r) => ({ kind: 'quotation', at: r.createdAt, id: r.id, label: `${r.number} — ${r.status}`, meta: r })),
    // The customer's own answer on the link, as its own moment.
    ...quotations.filter((r) => r.decidedAt && customerAnswer(r, byId)).map((r) => ({
      kind: 'quotation_response',
      at: r.decidedAt,
      id: r.id,
      label: `Customer ${customerAnswer(r, byId)} ${r.number} v${r.version} · NPR ${formatNpr(r.total, { withSymbol: false })}${
        r.decisionNote ? ` · ${r.decisionNote}` : ''}`,
      meta: r,
    })),
    ...jobs.map((r) => ({ kind: 'job', at: r.createdAt, id: r.id, label: `${r.number} — ${r.title}`, meta: r })),
    ...invoices.map((r) => ({ kind: 'invoice', at: r.createdAt, id: r.id, label: `${r.number} — ${r.status}`, meta: r })),
    ...warranties.map((r) => ({ kind: 'warranty', at: r.startsAt, id: r.id, label: `Warranty until ${r.endsAt.toISOString().slice(0, 10)}`, meta: r })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return entries;
}
