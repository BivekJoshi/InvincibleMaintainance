import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../utils/AppError.js';
import { parseListQuery, meta, searchOr } from '../utils/pagination.js';
import { normalizePhone } from '../utils/phone.js';

export async function listCustomers(query) {
  const { page, limit, skip, take, orderBy, q } = parseListQuery(query);
  const where = {
    deletedAt: null,
    ...(q ? { OR: searchOr(q, ['name', 'phone', 'email', 'panVatNo']) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where, orderBy, skip, take,
      include: { sites: { where: { deletedAt: null }, select: { id: true, label: true, address: true } },
        _count: { select: { jobs: true, invoices: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, meta: meta({ page, limit, total }) };
}

export async function getCustomer(id) {
  const c = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      sites: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      contracts: { where: { deletedAt: null }, orderBy: { endDate: 'desc' } },
      _count: { select: { jobs: true, invoices: true, quotations: true, leads: true } },
    },
  });
  if (!c) throw notFound('Customer');
  return c;
}

export async function createCustomer(data) {
  return prisma.customer.create({ data: { ...data, phone: normalizePhone(data.phone) } });
}

export async function updateCustomer(id, data) {
  await getCustomer(id);
  return prisma.customer.update({
    where: { id },
    data: { ...data, ...(data.phone ? { phone: normalizePhone(data.phone) } : {}) },
  });
}

export async function deleteCustomer(id) {
  const open = await prisma.job.count({ where: { customerId: id, status: { notIn: ['COMPLETED', 'VERIFIED', 'CANCELLED'] }, deletedAt: null } });
  if (open) throw badRequest(`This customer has ${open} open job(s). Close them first.`);
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Finds an existing customer by phone, or creates one — used by lead conversion. */
/** @param {import('@prisma/client').Prisma.TransactionClient} [client]  the caller's transaction, if any */
export async function findOrCreateByPhone({ name, phone, email, address, area, siteLabel }, client = prisma) {
  const normalized = normalizePhone(phone);
  let customer = await client.customer.findFirst({ where: { phone: normalized, deletedAt: null } });
  if (!customer) {
    customer = await client.customer.create({ data: { name, phone: normalized, email: email ?? null } });
  }
  let site = await client.customerSite.findFirst({ where: { customerId: customer.id, deletedAt: null, isPrimary: true } });
  if (!site && address) {
    site = await client.customerSite.create({
      data: { customerId: customer.id, label: siteLabel || 'Primary site', address, area: area ?? null, isPrimary: true },
    });
  }
  return { customer, site };
}

export async function listSites(customerId) {
  await getCustomer(customerId);
  return prisma.customerSite.findMany({
    where: { customerId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function createSite(customerId, data) {
  await getCustomer(customerId);
  if (data.isPrimary) {
    await prisma.customerSite.updateMany({ where: { customerId }, data: { isPrimary: false } });
  }
  return prisma.customerSite.create({ data: { ...data, customerId } });
}

export async function updateSite(customerId, siteId, data) {
  const site = await prisma.customerSite.findFirst({ where: { id: siteId, customerId, deletedAt: null } });
  if (!site) throw notFound('Site');
  if (data.isPrimary) {
    await prisma.customerSite.updateMany({ where: { customerId }, data: { isPrimary: false } });
  }
  return prisma.customerSite.update({ where: { id: siteId }, data });
}

export async function deleteSite(customerId, siteId) {
  const site = await prisma.customerSite.findFirst({ where: { id: siteId, customerId } });
  if (!site) throw notFound('Site');
  const jobs = await prisma.job.count({ where: { siteId, deletedAt: null } });
  if (jobs) throw badRequest(`This site has ${jobs} job(s) linked and cannot be removed`);
  await prisma.customerSite.update({ where: { id: siteId }, data: { deletedAt: new Date() } });
}

/** Everything that ever happened with this customer, newest first. */
export async function customerTimeline(id) {
  await getCustomer(id);
  const [leads, quotations, jobs, invoices, warranties] = await Promise.all([
    prisma.lead.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.quotation.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.job.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.warranty.findMany({ where: { customerId: id }, orderBy: { endsAt: 'desc' } }),
  ]);
  const entries = [
    ...leads.map((r) => ({ kind: 'lead', at: r.createdAt, id: r.id, label: `Enquiry — ${r.status}`, meta: r })),
    ...quotations.map((r) => ({ kind: 'quotation', at: r.createdAt, id: r.id, label: `${r.number} — ${r.status}`, meta: r })),
    ...jobs.map((r) => ({ kind: 'job', at: r.createdAt, id: r.id, label: `${r.number} — ${r.title}`, meta: r })),
    ...invoices.map((r) => ({ kind: 'invoice', at: r.createdAt, id: r.id, label: `${r.number} — ${r.status}`, meta: r })),
    ...warranties.map((r) => ({ kind: 'warranty', at: r.startsAt, id: r.id, label: `Warranty until ${r.endsAt.toISOString().slice(0, 10)}`, meta: r })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return entries;
}
